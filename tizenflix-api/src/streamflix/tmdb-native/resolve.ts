import { detectStreamType, slugify } from "../../normalize/detect-type.js";
import type { PlayResponse } from "../../types.js";
import { extractVideo } from "../extractors/registry.js";
import { getCfBypassUsedInContext, runWithCfContext } from "../network/client.js";
import type { ExtractedVideo } from "../types.js";
import { AUTO_TMDB_SOURCE_IDS } from "./auto-sources.js";
import { getTmdbNativeSourceById, getTmdbNativeSources } from "./registry.js";
import type { TmdbNativeResolveOpts, TmdbNativeSourceResult } from "./types.js";

export interface TmdbNativeResolveOptions extends TmdbNativeResolveOpts {
  sourceTimeoutMs?: number;
  onlySourceId?: string;
  onlySourceIds?: string[];
  /** Keep best stream per source (for auto merge). */
  onePerSource?: boolean;
  /** Explicit priority order for merge (auto source ids). */
  mergeOrder?: string[];
}

type ResolvedEntry = {
  serverName: string;
  sourceName: string;
  sourceId: string;
  video: ExtractedVideo;
  ms: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const SLOW_SOURCE_TIMEOUT_MS = 30_000;
const SLOW_SOURCES = new Set(["twoembed", "vidsrcnet", "vidsrcto"]);

function sourceTimeoutMs(sourceId: string, base: number): number {
  return SLOW_SOURCES.has(sourceId) ? Math.max(base, SLOW_SOURCE_TIMEOUT_MS) : base;
}

function classifyLayer(msg: string): TmdbNativeSourceResult["layer"] {
  if (msg.includes("Playwright") || msg.includes("Chromium")) return "infra";
  if (msg.includes("preflight") || msg.includes("unreachable")) return "preflight";
  if (msg.includes("api") || msg.includes("API") || msg.includes("JSON")) return "api_hop";
  if (msg.includes("HTTP") || msg.includes("403") || msg.includes("timeout")) return "network";
  return "extract";
}

function toPlayResponse(
  opts: TmdbNativeResolveOptions,
  entries: ResolvedEntry[],
  priorityOffset = 0
): PlayResponse {
  const sources: PlayResponse["sources"] = [];
  const subtitleMap = new Map<string, PlayResponse["subtitles"][0]>();

  for (const entry of entries) {
    const type = detectStreamType(entry.video.source);
    sources.push({
      id: `tmdb-${slugify(entry.sourceId)}-${slugify(entry.serverName)}-${sources.length}`,
      provider: `${entry.sourceName}/${entry.serverName}`,
      label: entry.serverName,
      type,
      url: entry.video.source,
      priority: priorityOffset + sources.length,
      sourceId: entry.sourceId,
      upstreamHeaders: entry.video.headers,
    });
    for (const sub of entry.video.subtitles) {
      if (!sub.file) continue;
      const key = `${sub.label}::${sub.file}`;
      if (subtitleMap.has(key)) continue;
      subtitleMap.set(key, {
        id: `sub-${subtitleMap.size}`,
        language: sub.label,
        label: sub.label,
        url: sub.file,
        default: subtitleMap.size === 0,
      });
    }
  }

  const hls = sources.filter((s) => s.type === "m3u8");
  const filtered = hls.length ? hls : sources;

  return {
    title: opts.title,
    type: opts.type,
    tmdbId: opts.tmdbId,
    season: opts.type === "tv" ? opts.season : undefined,
    episode: opts.type === "tv" ? opts.episode : undefined,
    sources: filtered,
    recommended: filtered[0]?.id ?? null,
    subtitles: Array.from(subtitleMap.values()),
    nextEpisode:
      opts.type === "tv" && opts.season && opts.episode
        ? { season: opts.season, episode: String(parseInt(opts.episode, 10) + 1) }
        : null,
    backend: "tmdb-native",
  };
}

function pickBestPerSource(results: TmdbNativeSourceResult[]): ResolvedEntry[] {
  const picked: ResolvedEntry[] = [];
  for (const r of results) {
    if (!r.ok || !r.resolved?.length) continue;
    const hls = r.resolved.filter((e) => detectStreamType(e.video.source) === "m3u8");
    const pool = hls.length ? hls : r.resolved;
    const best = pool[0];
    if (!best) continue;
    picked.push({
      ...best,
      sourceId: r.sourceId,
      ms: r.ms,
    });
  }
  return picked;
}

function mergeByOrder(
  results: TmdbNativeSourceResult[],
  order: string[],
  onePerSource: boolean
): ResolvedEntry[] {
  const byId = new Map(results.filter((r) => r.ok).map((r) => [r.sourceId, r]));
  const merged: ResolvedEntry[] = [];
  const seenHosts = new Set<string>();

  const appendEntries = (entries: ResolvedEntry[]) => {
    for (const entry of entries) {
      let host = entry.video.source;
      try {
        host = new URL(entry.video.source).hostname;
      } catch {
        /* keep */
      }
      if (seenHosts.has(host)) continue;
      seenHosts.add(host);
      merged.push(entry);
    }
  };

  for (const sourceId of order) {
    const r = byId.get(sourceId);
    if (!r?.resolved?.length) continue;
    if (onePerSource) {
      appendEntries(pickBestPerSource([r]));
    } else {
      appendEntries(
        r.resolved.map((e) => ({ ...e, sourceId: r.sourceId, ms: r.ms }))
      );
    }
  }

  return merged;
}

async function resolveOneSource(
  source: ReturnType<typeof getTmdbNativeSources>[0],
  opts: TmdbNativeResolveOptions,
  timeoutMs: number
): Promise<TmdbNativeSourceResult> {
  const started = Date.now();
  const base: TmdbNativeSourceResult = {
    sourceId: source.id,
    sourceName: source.name,
    ok: false,
    ms: 0,
    servers: 0,
    hls: 0,
    subtitles: 0,
    duplicateOf: source.duplicateOf,
  };

  const perSourceTimeout = sourceTimeoutMs(source.id, timeoutMs);

  try {
    const result = await Promise.race([
      runWithCfContext(async () => {
        const entries = await source.buildEntries(opts);
        if (!entries.length) throw new Error("api_hop: no server entries");

        const resolved: Array<Omit<ResolvedEntry, "sourceId" | "ms">> = [];
        const errors: string[] = [];

        for (const entry of entries.slice(0, 8)) {
          try {
            const video = await extractVideo(entry.url, entry.name);
            if (!video.source) continue;
            resolved.push({
              serverName: entry.name,
              sourceName: source.name,
              video,
            });
            if (opts.onePerSource) break;
          } catch (err) {
            errors.push(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        if (!resolved.length) {
          throw new Error(errors.join("; ") || "extract: no playable sources");
        }

        return { resolved, cfBypassUsed: getCfBypassUsedInContext() };
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("network: source timeout")), perSourceTimeout)
      ),
    ]);

    const hls = result.resolved.filter(
      (e) => detectStreamType(e.video.source) === "m3u8"
    ).length;
    const subtitles = result.resolved.reduce((n, e) => n + e.video.subtitles.length, 0);

    return {
      ...base,
      ok: true,
      ms: Date.now() - started,
      servers: result.resolved.length,
      hls,
      subtitles,
      cfBypassUsed: result.cfBypassUsed,
      entries: result.resolved.map((e) => ({
        serverName: e.serverName,
        sourceName: e.sourceName,
        url: e.video.source,
        type: detectStreamType(e.video.source),
      })),
      resolved: result.resolved.map((e) => ({
        ...e,
        sourceId: source.id,
        ms: Date.now() - started,
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      ms: Date.now() - started,
      error: msg,
      layer: classifyLayer(msg),
      cfBypassUsed: getCfBypassUsedInContext(),
    };
  }
}

function resolveSourceList(opts: TmdbNativeResolveOptions) {
  let sources = getTmdbNativeSources(opts.type);
  if (opts.onlySourceIds?.length) {
    sources = opts.onlySourceIds
      .map((id) => getTmdbNativeSourceById(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  } else if (opts.onlySourceId) {
    const one = getTmdbNativeSourceById(opts.onlySourceId);
    sources = one ? [one] : [];
  }
  return sources;
}

export async function resolveTmdbNativePlay(
  opts: TmdbNativeResolveOptions
): Promise<PlayResponse & { sourceResults?: TmdbNativeSourceResult[] }> {
  const timeoutMs = opts.sourceTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sources = resolveSourceList(opts);

  const results = await Promise.all(
    sources.map((s) => resolveOneSource(s, opts, timeoutMs))
  );

  const mergeOrder =
    opts.mergeOrder ??
    (opts.onlySourceIds?.length ? opts.onlySourceIds : sources.map((s) => s.id));

  const merged = mergeByOrder(results, mergeOrder, opts.onePerSource ?? false);

  const play = toPlayResponse(opts, merged);
  play.sourceResults = results;
  const warnings = results.filter((r) => !r.ok).map((r) => `${r.sourceName}: ${r.error}`);
  if (warnings.length) play.warnings = warnings;

  if (!merged.length) {
    const err = new Error(
      results.map((r) => `${r.sourceName}: ${r.error ?? "unknown"}`).join("; ")
    ) as Error & { sourceResults?: typeof results };
    err.sourceResults = results;
    throw err;
  }

  return play;
}

export function autoTmdbSourceIdsForType(type: "movie" | "tv"): string[] {
  return AUTO_TMDB_SOURCE_IDS.filter((id) => {
    const src = getTmdbNativeSourceById(id);
    if (!src) return false;
    return type === "movie" ? src.supportsMovies : src.supportsTv;
  });
}

export async function resolveTmdbNativeFromOptions(
  options: import("../../types.js").ResolveOptions & { title?: string; imdbId?: string; year?: string | number },
  fetchImpl: typeof fetch = fetch
): Promise<PlayResponse> {
  const { fetchMetadata } = await import("../../api/metadata.js");
  const meta = await fetchMetadata(options.type, options.tmdbId, fetchImpl);

  return resolveTmdbNativePlay({
    type: options.type,
    tmdbId: options.tmdbId,
    season: options.season,
    episode: options.episode,
    title: meta.title,
    year: meta.year,
    imdbId: meta.imdbId,
    lang: "en",
    onlySourceId: options.onlySourceId,
    onlySourceIds: options.onlySourceIds,
    onePerSource: options.onePerSource,
    mergeOrder: options.mergeOrder,
    sourceTimeoutMs: options.sourceTimeoutMs,
  });
}
