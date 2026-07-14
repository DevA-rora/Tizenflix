import { fetchMetadata } from "../api/metadata.js";
import { resolvePlayableSources } from "../normalize/to-play-response.js";
import { resolveTmdbNativeFromOptions } from "../streamflix/tmdb-native/resolve.js";
import { isAnime } from "../tmdb/is-anime.js";
import type { Metadata, PlayResponse, ResolveOptions } from "../types.js";

const STREAMFLIX_AUTO_TIMEOUT_MS = 15_000;

function tagBackend(play: PlayResponse, backend: PlayResponse["backend"], ms: number): PlayResponse {
  return { ...play, backend, resolveMs: ms };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

function hasPlayableSources(play: PlayResponse | null): play is PlayResponse {
  return Boolean(play?.sources?.length);
}

function basePlayFromMeta(
  options: ResolveOptions,
  meta: Metadata
): Pick<PlayResponse, "title" | "imdbId" | "type" | "tmdbId" | "season" | "episode"> {
  return {
    title: meta.title,
    imdbId: meta.imdbId,
    type: options.type,
    tmdbId: options.tmdbId,
    season: options.type === "tv" ? options.season : undefined,
    episode: options.type === "tv" ? options.episode : undefined,
  };
}

function emptyStreamflixPlay(
  options: ResolveOptions,
  meta: Metadata,
  warnings: string[]
): PlayResponse {
  return {
    ...basePlayFromMeta(options, meta),
    sources: [],
    recommended: null,
    subtitles: [],
    nextEpisode: null,
    backend: "auto",
    warnings,
  };
}

/** backend=auto is Streamflix-only (alias for scraper-first playback). */
async function resolveAutoTiered(
  options: ResolveOptions,
  fetchImpl: typeof fetch
): Promise<PlayResponse> {
  const t0 = Date.now();
  const lang = options.lang ?? "en";
  const meta = await fetchMetadata(options.type, options.tmdbId, fetchImpl);
  const baseMeta = basePlayFromMeta(options, meta);
  const anime = isAnime(meta);

  const { resolveStreamflixFromOptions } = await import("../streamflix/resolve.js");
  try {
    const streamflixPlay = await resolveStreamflixFromOptions(
      {
        ...options,
        lang,
        isAnime: anime,
        preferredProviderId: options.preferredProviderId,
        autoMode: true,
        sourceTimeoutMs: STREAMFLIX_AUTO_TIMEOUT_MS,
      },
      fetchImpl
    );
    if (hasPlayableSources(streamflixPlay)) {
      return tagBackend({ ...streamflixPlay, ...baseMeta, backend: "auto" }, "auto", Date.now() - t0);
    }
    return tagBackend(
      { ...streamflixPlay, ...baseMeta, backend: "auto" },
      "auto",
      Date.now() - t0
    );
  } catch (err) {
    const providerResults =
      err instanceof Error && "providerResults" in err
        ? (err as Error & { providerResults?: { provider: string; error?: string }[] }).providerResults
        : undefined;
    const warnings =
      providerResults?.map((r) => `${r.provider}: ${r.error ?? "unknown"}`) ??
      [err instanceof Error ? err.message : String(err)];
    return tagBackend(emptyStreamflixPlay(options, meta, warnings), "auto", Date.now() - t0);
  }
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
      resolveStreamflixFromOptions(
        {
          ...options,
          autoMode: !options.providerId,
          sourceTimeoutMs: options.sourceTimeoutMs ?? STREAMFLIX_AUTO_TIMEOUT_MS,
        },
        fetchImpl
      )
    );
    return tagBackend(result, "streamflix", ms);
  }

  if (options.onlySourceId || options.onlySourceIds?.length) {
    const { result, ms } = await timed(() =>
      resolveTmdbNativeFromOptions(
        {
          ...options,
          onePerSource: true,
          mergeOrder: options.onlySourceIds ?? (options.onlySourceId ? [options.onlySourceId] : undefined),
        },
        fetchImpl
      )
    );
    return tagBackend({ ...result, backend: "auto" }, "auto", ms);
  }

  return resolveAutoTiered(options, fetchImpl);
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

export function parseLangParam(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.trim().toLowerCase().split("-")[0];
}

export function parseAudioLangParam(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const value = raw.trim().toLowerCase().split("-")[0]!;
  if (value === "original") return "original";
  if (/^[a-z]{2}$/.test(value)) return value;
  return undefined;
}

export function parseProviderIdParam(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.trim().toLowerCase();
}

export function parsePreferredProviderIdParam(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.trim().toLowerCase();
}

export function parseRaceParam(raw: unknown): boolean {
  return raw === "1" || raw === "true";
}
