import { parseMaxManifestHeight } from "./rewrite-m3u8.js";
import { fetchProxiedStream } from "./upstream.js";
import type { PlayResponse, PlayableSource } from "../types.js";

export interface ManifestProbe {
  ok: boolean;
  status: number;
  reason?: string;
  segmentMs?: number;
  /** Highest RESOLUTION= height parsed from manifest body */
  maxHeight?: number;
}

export interface ValidatePlayOptions {
  reportProvider?: (provider: string, success: boolean) => void;
  providerScore?: (provider: string) => number | null;
  tizenProfile?: boolean;
  /** Max m3u8 sources to probe before respond; rest are unverified fallbacks. */
  probeLimit?: number;
  /** Prefer sources matching this label (e.g. 1080p, 4K). */
  preferredQuality?: string;
}

export function parseHeightFromLabel(label: string): number {
  const lower = label.toLowerCase();
  if (/4k|2160/.test(lower)) return 2160;
  const match = label.match(/(\d+)\s*p/i);
  if (match) return parseInt(match[1], 10);
  return 0;
}

function parseBandwidthFromLabel(label: string): number {
  const h = parseHeightFromLabel(label);
  if (h > 0) return h * 1000;
  if (/auto/i.test(label)) return 9999;
  return 0;
}

function targetHeightFromPreferredQuality(preferred?: string): number {
  if (!preferred) return 0;
  return parseHeightFromLabel(preferred);
}

export function effectiveSourceHeight(source: PlayableSource, probe?: ManifestProbe): number {
  const manifestH = probe?.maxHeight ?? 0;
  const labelH = parseHeightFromLabel(source.label);
  return manifestH > 0 ? manifestH : labelH;
}

function firstSegmentUrl(manifestBody: string): string | null {
  for (const line of manifestBody.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) return trimmed;
  }
  return null;
}

/** Fetch upstream manifest and confirm it is a real HLS playlist. */
export async function probeHlsManifest(
  upstreamUrl: string,
  publicBase: string,
  fetchImpl: typeof fetch = fetch
): Promise<ManifestProbe> {
  try {
    const result = await fetchProxiedStream(upstreamUrl, publicBase, fetchImpl);
    const body = typeof result.body === "string" ? result.body : "";

    if (result.status < 200 || result.status >= 300) {
      return {
        ok: false,
        status: result.status,
        reason: `CDN returned HTTP ${result.status}`,
      };
    }

    if (!body.trimStart().startsWith("#EXTM3U")) {
      const preview = body.trim().slice(0, 40).replace(/\s+/g, " ");
      return {
        ok: false,
        status: result.status,
        reason: preview ? `not HLS (${preview})` : "not an HLS manifest",
      };
    }

    const maxHeight = parseMaxManifestHeight(body);
    let segmentMs: number | undefined;
    const segUrl = firstSegmentUrl(body);
    if (segUrl) {
      const t0 = Date.now();
      try {
        const seg = await fetchImpl(segUrl, { method: "GET" });
        segmentMs = Date.now() - t0;
        if (!seg.ok) {
          return {
            ok: false,
            status: seg.status,
            reason: `first segment HTTP ${seg.status}`,
            segmentMs,
            maxHeight: maxHeight > 0 ? maxHeight : undefined,
          };
        }
      } catch (err) {
        return {
          ok: false,
          status: 0,
          reason: err instanceof Error ? err.message : String(err),
          segmentMs: Date.now() - t0,
          maxHeight: maxHeight > 0 ? maxHeight : undefined,
        };
      }
    }

    return {
      ok: true,
      status: result.status,
      segmentMs,
      maxHeight: maxHeight > 0 ? maxHeight : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ValidatedPlayResponse extends PlayResponse {
  warnings?: string[];
}

interface RankedSource {
  source: PlayableSource;
  probe: ManifestProbe;
  healthScore: number;
}

function qualityScore(height: number, targetPx: number): number {
  if (!height) return -1;
  if (height === targetPx) return 10000 + height;
  if (height < targetPx) return 5000 + height;
  return height;
}

function sortSourcesForProbe(sources: PlayableSource[], preferredQuality?: string): PlayableSource[] {
  const targetPx = targetHeightFromPreferredQuality(preferredQuality);
  if (!targetPx) return sources;

  return sources.slice().sort((a, b) => {
    const sa = qualityScore(parseHeightFromLabel(a.label), targetPx);
    const sb = qualityScore(parseHeightFromLabel(b.label), targetPx);
    if (sa !== sb) return sb - sa;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return parseHeightFromLabel(b.label) - parseHeightFromLabel(a.label);
  });
}

function isVixSrcProvider(provider: string): boolean {
  return /^vixsrc/i.test(provider);
}

function sortPlayableSources(
  ranked: RankedSource[],
  preferredQuality?: string
): PlayableSource[] {
  const targetPx = targetHeightFromPreferredQuality(preferredQuality);

  return ranked
    .slice()
    .sort((a, b) => {
      if (targetPx) {
        const ha = effectiveSourceHeight(a.source, a.probe);
        const hb = effectiveSourceHeight(b.source, b.probe);
        const sa = qualityScore(ha, targetPx);
        const sb = qualityScore(hb, targetPx);
        if (sa !== sb) return sb - sa;
        if (ha !== hb) return hb - ha;
      }

      if (a.source.priority !== b.source.priority) {
        return a.source.priority - b.source.priority;
      }
      const vixA = isVixSrcProvider(a.source.provider);
      const vixB = isVixSrcProvider(b.source.provider);
      if (vixA !== vixB) return vixA ? -1 : 1;
      const bwA = parseBandwidthFromLabel(a.source.label);
      const bwB = parseBandwidthFromLabel(b.source.label);
      if (bwA !== bwB) return bwB - bwA;
      const segA = a.probe.segmentMs ?? 99999;
      const segB = b.probe.segmentMs ?? 99999;
      if (segA !== segB) return segA - segB;
      if (a.healthScore !== b.healthScore) return b.healthScore - a.healthScore;
      return 0;
    })
    .map((r) => r.source);
}

async function probeSource(
  source: PlayableSource,
  publicBase: string,
  fetchImpl: typeof fetch,
  options: ValidatePlayOptions
): Promise<{ source: PlayableSource; ranked?: RankedSource; warning?: string }> {
  if (source.type !== "m3u8") {
    if (!options.tizenProfile) {
      return {
        source,
        warning: `${source.provider} ${source.label}: ${source.type} is not supported on Tizen (HLS only)`,
      };
    }
    return { source };
  }

  const probe = await probeHlsManifest(source.url, publicBase, fetchImpl);
  if (probe.ok) {
    options.reportProvider?.(source.provider, true);
    return {
      source,
      ranked: {
        source,
        probe,
        healthScore: options.providerScore?.(source.provider) ?? 0.5,
      },
    };
  }

  options.reportProvider?.(source.provider, false);
  if (options.tizenProfile) {
    console.warn(
      `[validate] ${source.provider} ${source.label}: ${probe.reason ?? "manifest unavailable"}`
    );
    return {
      source,
      warning: `${source.provider} ${source.label}: ${probe.reason ?? "manifest unavailable"}`,
    };
  }
  return {
    source,
    warning: `${source.provider} ${source.label}: ${probe.reason ?? "manifest unavailable"}`,
  };
}

/** Probe each m3u8 source; playable sources first, with human-readable warnings. */
export async function validatePlaySources(
  play: PlayResponse,
  publicBase: string,
  fetchImpl: typeof fetch = fetch,
  options: ValidatePlayOptions = {}
): Promise<ValidatedPlayResponse> {
  const warnings: string[] = [];
  const rankedPlayable: RankedSource[] = [];
  const blocked: PlayableSource[] = [];

  const m3u8Sources = sortSourcesForProbe(
    play.sources.filter((s) => s.type === "m3u8"),
    options.preferredQuality
  );
  const nonM3u8 = play.sources.filter((s) => s.type !== "m3u8");
  const probeLimit = options.probeLimit ?? Number.POSITIVE_INFINITY;
  const toProbe = m3u8Sources.slice(0, probeLimit);
  const unprobedM3u8 = m3u8Sources.slice(probeLimit);

  if (!options.tizenProfile) {
    for (const source of nonM3u8) {
      warnings.push(
        `${source.provider} ${source.label}: ${source.type} is not supported on Tizen (HLS only)`
      );
      blocked.push(source);
    }
  }

  const probeResults = await Promise.all(
    toProbe.map((source) => probeSource(source, publicBase, fetchImpl, options))
  );

  for (const source of unprobedM3u8) {
    rankedPlayable.push({
      source,
      probe: { ok: true, status: 200 },
      healthScore: options.providerScore?.(source.provider) ?? 0.5,
    });
  }

  for (const result of probeResults) {
    if (result.ranked) {
      rankedPlayable.push(result.ranked);
    } else if (result.warning) {
      warnings.push(result.warning);
      blocked.push(result.source);
    } else if (!options.tizenProfile) {
      blocked.push(result.source);
    }
  }

  const playable = sortPlayableSources(rankedPlayable, options.preferredQuality);
  const sources = options.tizenProfile ? playable : [...playable, ...blocked];

  const targetPx = targetHeightFromPreferredQuality(options.preferredQuality);
  if (targetPx && playable.length) {
    const bestRanked = rankedPlayable.find((r) => r.source.id === playable[0]!.id);
    const bestH = effectiveSourceHeight(
      playable[0]!,
      bestRanked?.probe ?? rankedPlayable[0]?.probe
    );
    if (bestH > 0 && bestH < targetPx) {
      const label =
        bestH >= 2160 ? "4K" : bestH >= 1080 ? "1080p" : bestH >= 720 ? "720p" : `${bestH}p`;
      warnings.push(
        `No ${options.preferredQuality} source available — playing best available (${label})`
      );
    }
  }

  if (!playable.length && play.sources.length) {
    warnings.push(
      options.tizenProfile
        ? "No playable HLS stream for this title right now. Try again later."
        : "No playable HLS sources right now — CDN may be blocking your network. Try again later or use Test LAN HLS."
    );
  }

  return {
    ...play,
    sources,
    recommended: playable[0]?.id ?? null,
    warnings: warnings.length ? warnings : undefined,
  };
}
