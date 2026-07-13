import { fetchProxiedStream } from "./upstream.js";
import type { PlayResponse, PlayableSource } from "../types.js";

export interface ManifestProbe {
  ok: boolean;
  status: number;
  reason?: string;
  segmentMs?: number;
}

export interface ValidatePlayOptions {
  reportProvider?: (provider: string, success: boolean) => void;
  providerScore?: (provider: string) => number | null;
  tizenProfile?: boolean;
  /** Max m3u8 sources to probe before respond; rest are unverified fallbacks. */
  probeLimit?: number;
}

function parseBandwidthFromLabel(label: string): number {
  const match = label.match(/(\d+)\s*p/i);
  if (match) return parseInt(match[1], 10) * 1000;
  if (/auto/i.test(label)) return 9999;
  return 0;
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
          };
        }
      } catch (err) {
        return {
          ok: false,
          status: 0,
          reason: err instanceof Error ? err.message : String(err),
          segmentMs: Date.now() - t0,
        };
      }
    }

    return { ok: true, status: result.status, segmentMs };
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

function isVixSrcProvider(provider: string): boolean {
  return /^vixsrc/i.test(provider);
}

function sortPlayableSources(ranked: RankedSource[]): PlayableSource[] {
  return ranked
    .slice()
    .sort((a, b) => {
      if (a.source.priority !== b.source.priority) {
        return a.source.priority - b.source.priority;
      }
      const vixA = isVixSrcProvider(a.source.provider);
      const vixB = isVixSrcProvider(b.source.provider);
      if (vixA !== vixB) return vixA ? -1 : 1;
      const segA = a.probe.segmentMs ?? 99999;
      const segB = b.probe.segmentMs ?? 99999;
      if (segA !== segB) return segA - segB;
      if (a.healthScore !== b.healthScore) return b.healthScore - a.healthScore;
      return parseBandwidthFromLabel(b.source.label) - parseBandwidthFromLabel(a.source.label);
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
    return { source };
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

  const m3u8Sources = play.sources.filter((s) => s.type === "m3u8");
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

  const playable = sortPlayableSources(rankedPlayable);
  const sources = options.tizenProfile ? playable : [...playable, ...blocked];

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
