import { resolvePlayableSources } from "../normalize/to-play-response.js";
import { resolveTmdbNativeFromOptions } from "../streamflix/tmdb-native/resolve.js";
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
  vidking: PlayResponse | null,
  tmdbNative: PlayResponse | null,
  vidkingMs: number,
  tmdbNativeMs: number
): PlayResponse {
  if (!vidking && !tmdbNative) {
    throw new Error("No playable sources from Vidking or TMDB-native backends");
  }
  if (!vidking) {
    return tagBackend(tmdbNative!, "tmdb-native", tmdbNativeMs);
  }
  if (!tmdbNative) {
    return tagBackend(vidking, "vidking", vidkingMs);
  }

  const sources = [
    ...tmdbNative.sources.map((s) => ({ ...s, priority: s.priority })),
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
    `auto: vixsrc/tmdb-native ${tmdbNativeMs}ms, vidking ${vidkingMs}ms`,
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
    resolveMs: Math.max(vidkingMs, tmdbNativeMs),
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

  // auto — VixSrc (tmdb-native) primary, Vidking fallback
  const [vidkingSettled, tmdbSettled] = await Promise.allSettled([
    timed(() => resolvePlayableSources(options, fetchImpl)),
    timed(() =>
      resolveTmdbNativeFromOptions({ ...options, onlySourceId: "vixsrc" }, fetchImpl)
    ),
  ]);

  const vidking =
    vidkingSettled.status === "fulfilled" ? vidkingSettled.value.result : null;
  const tmdbNative =
    tmdbSettled.status === "fulfilled" ? tmdbSettled.value.result : null;
  const vidkingMs =
    vidkingSettled.status === "fulfilled" ? vidkingSettled.value.ms : 0;
  const tmdbNativeMs =
    tmdbSettled.status === "fulfilled" ? tmdbSettled.value.ms : 0;

  return mergeAutoResults(vidking, tmdbNative, vidkingMs, tmdbNativeMs);
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
