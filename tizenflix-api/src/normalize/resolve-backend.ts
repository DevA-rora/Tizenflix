import { resolvePlayableSources } from "../normalize/to-play-response.js";
import {
  autoTmdbSourceIdsForType,
  resolveTmdbNativeFromOptions,
} from "../streamflix/tmdb-native/resolve.js";
import type { PlayResponse, ResolveOptions } from "../types.js";

function tagBackend(play: PlayResponse, backend: PlayResponse["backend"], ms: number): PlayResponse {
  return { ...play, backend, resolveMs: ms };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

function mergeAutoResults(
  tmdbNative: PlayResponse | null,
  vidking: PlayResponse | null,
  tmdbNativeMs: number,
  vidkingMs: number
): PlayResponse {
  if (!tmdbNative && !vidking) {
    throw new Error("No playable sources from TMDB-native or Vidking backends");
  }
  if (!vidking) {
    return tagBackend({ ...tmdbNative!, backend: "auto" }, "auto", tmdbNativeMs);
  }
  if (!tmdbNative?.sources.length) {
    const sources = vidking.sources.map((s) => ({
      ...s,
      priority: s.priority + 1000,
    }));
    return {
      ...vidking,
      sources,
      recommended: sources[0]?.id ?? null,
      warnings: [
        ...(vidking.warnings ?? []),
        `auto: tmdb-native unavailable, vidking ${vidkingMs}ms`,
      ],
      backend: "auto",
      resolveMs: Math.max(tmdbNativeMs, vidkingMs),
    };
  }

  const sources = [
    ...tmdbNative.sources,
    ...vidking.sources.map((s) => ({
      ...s,
      priority: s.priority + 1000,
    })),
  ];

  const subtitleKeys = new Set<string>();
  const subtitles = [...tmdbNative.subtitles, ...vidking.subtitles].filter((sub) => {
    const key = `${sub.language}::${sub.url}`;
    if (subtitleKeys.has(key)) return false;
    subtitleKeys.add(key);
    return true;
  });

  const warnings = [
    ...(tmdbNative.warnings ?? []),
    ...(vidking.warnings ?? []),
    `auto: tmdb-native ${tmdbNativeMs}ms, vidking ${vidkingMs}ms`,
  ];

  return {
    title: vidking.title ?? tmdbNative.title,
    type: vidking.type,
    tmdbId: vidking.tmdbId,
    season: vidking.season,
    episode: vidking.episode,
    sources,
    recommended: sources[0]?.id ?? null,
    subtitles,
    nextEpisode: vidking.nextEpisode ?? tmdbNative.nextEpisode,
    warnings,
    backend: "auto",
    resolveMs: Math.max(tmdbNativeMs, vidkingMs),
  };
}

export async function resolveWithBackend(
  options: ResolveOptions,
  fetchImpl: typeof fetch = fetch
): Promise<PlayResponse> {
  const backend = options.backend ?? "auto";

  if (backend === "vidking") {
    const { result, ms } = await timed(() => resolvePlayableSources(options, fetchImpl));
    return tagBackend(result, "vidking", ms);
  }

  if (backend === "tmdb-native") {
    const { result, ms } = await timed(() =>
      resolveTmdbNativeFromOptions(options, fetchImpl)
    );
    return tagBackend(result, "tmdb-native", ms);
  }

  if (backend === "streamflix") {
    const { resolveStreamflixFromOptions } = await import("../streamflix/resolve.js");
    const { result, ms } = await timed(() =>
      resolveStreamflixFromOptions(options, fetchImpl)
    );
    return tagBackend(result, "streamflix", ms);
  }

  const autoIds =
    options.onlySourceIds ??
    options.sources ??
    autoTmdbSourceIdsForType(options.type);

  const [tmdbSettled, vidkingSettled] = await Promise.allSettled([
    timed(() =>
      resolveTmdbNativeFromOptions(
        {
          ...options,
          onlySourceIds: autoIds,
          onePerSource: true,
          mergeOrder: autoIds,
        },
        fetchImpl
      )
    ),
    timed(() => resolvePlayableSources(options, fetchImpl)),
  ]);

  const tmdbNative =
    tmdbSettled.status === "fulfilled" ? tmdbSettled.value.result : null;
  const vidking =
    vidkingSettled.status === "fulfilled" ? vidkingSettled.value.result : null;
  const tmdbNativeMs =
    tmdbSettled.status === "fulfilled" ? tmdbSettled.value.ms : 0;
  const vidkingMs =
    vidkingSettled.status === "fulfilled" ? vidkingSettled.value.ms : 0;

  return mergeAutoResults(tmdbNative, vidking, tmdbNativeMs, vidkingMs);
}

export function parseBackendParam(raw: unknown): ResolveOptions["backend"] {
  if (
    raw === "streamflix" ||
    raw === "auto" ||
    raw === "vidking" ||
    raw === "tmdb-native"
  ) {
    return raw;
  }
  return "auto";
}

export function parseSourcesParam(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
