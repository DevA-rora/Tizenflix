import { fetchMetadata } from "../api/metadata.js";
import { resolvePlayableSources } from "../normalize/to-play-response.js";
import { AUTO_PROVIDER_TIMEOUT_MS } from "../streamflix/provider-order.js";
import { AUTO_TMDB_SOURCE_IDS } from "../streamflix/tmdb-native/auto-sources.js";
import { resolveTmdbNativeFromOptions } from "../streamflix/tmdb-native/resolve.js";
import { isAnime } from "../tmdb/is-anime.js";
import type { Metadata, PlayResponse, ResolveOptions } from "../types.js";

const STREAMFLIX_AUTO_TIMEOUT_MS = AUTO_PROVIDER_TIMEOUT_MS;

/** TMDB-native embeds after VixSrc was already tried as its own tier. */
const REMAINING_TMDB_SOURCE_IDS = AUTO_TMDB_SOURCE_IDS.filter((id) => id !== "vixsrc");

function tagBackend(play: PlayResponse, backend: PlayResponse["backend"], ms: number): PlayResponse {
  return { ...play, backend, resolveMs: ms };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

function hasPlayableSources(play: PlayResponse | null | undefined): boolean {
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

function emptyAutoPlay(options: ResolveOptions, meta: Metadata, warnings: string[]): PlayResponse {
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

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * backend=auto: Videasy CDN → VixSrc → Streamflix scrapers → other TMDB embeds → Vidking last.
 */
async function resolveAutoTiered(
  options: ResolveOptions,
  fetchImpl: typeof fetch
): Promise<PlayResponse> {
  const t0 = Date.now();
  const lang = options.lang ?? "en";
  const meta = await fetchMetadata(options.type, options.tmdbId, fetchImpl);
  const baseMeta = basePlayFromMeta(options, meta);
  const anime = isAnime(meta);
  const warnings: string[] = [];

  try {
    const videasyPlay = await resolvePlayableSources(
      {
        ...options,
        backend: "videasy",
        cdnIdentity: "videasy",
        allServers: false,
        firstSuccessOnly: true,
      },
      fetchImpl
    );
    if (hasPlayableSources(videasyPlay)) {
      return tagBackend(
        {
          ...videasyPlay,
          ...baseMeta,
          backend: "auto",
          warnings: videasyPlay.warnings?.length ? videasyPlay.warnings : undefined,
        },
        "auto",
        Date.now() - t0
      );
    }
    warnings.push("videasy: no sources");
  } catch (err) {
    warnings.push(`videasy: ${errMessage(err)}`);
  }

  try {
    const vixPlay = await resolveTmdbNativeFromOptions(
      {
        ...options,
        onePerSource: true,
        mergeOrder: ["vixsrc"],
        onlySourceId: "vixsrc",
      },
      fetchImpl
    );
    if (hasPlayableSources(vixPlay)) {
      const mergedWarnings = [...warnings, ...(vixPlay.warnings ?? [])];
      return tagBackend(
        {
          ...vixPlay,
          ...baseMeta,
          backend: "auto",
          warnings: mergedWarnings.length ? mergedWarnings : undefined,
        },
        "auto",
        Date.now() - t0
      );
    }
    warnings.push("vixsrc: no sources");
  } catch (err) {
    warnings.push(`vixsrc: ${errMessage(err)}`);
  }

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
      const mergedWarnings = [...warnings, ...(streamflixPlay.warnings ?? [])];
      return tagBackend(
        {
          ...streamflixPlay,
          ...baseMeta,
          backend: "auto",
          warnings: mergedWarnings.length ? mergedWarnings : undefined,
        },
        "auto",
        Date.now() - t0
      );
    }
    if (streamflixPlay.warnings?.length) warnings.push(...streamflixPlay.warnings);
    else warnings.push("streamflix: no sources");
  } catch (err) {
    const providerResults =
      err instanceof Error && "providerResults" in err
        ? (err as Error & { providerResults?: { provider: string; error?: string }[] })
            .providerResults
        : undefined;
    if (providerResults?.length) {
      warnings.push(
        ...providerResults.map((r) => `${r.provider}: ${r.error ?? "unknown"}`)
      );
    } else {
      warnings.push(`streamflix: ${errMessage(err)}`);
    }
  }

  if (REMAINING_TMDB_SOURCE_IDS.length) {
    try {
      const tmdbPlay = await resolveTmdbNativeFromOptions(
        {
          ...options,
          onePerSource: true,
          mergeOrder: [...REMAINING_TMDB_SOURCE_IDS],
        },
        fetchImpl
      );
      if (hasPlayableSources(tmdbPlay)) {
        const mergedWarnings = [...warnings, ...(tmdbPlay.warnings ?? [])];
        return tagBackend(
          {
            ...tmdbPlay,
            ...baseMeta,
            backend: "auto",
            warnings: mergedWarnings.length ? mergedWarnings : undefined,
          },
          "auto",
          Date.now() - t0
        );
      }
      warnings.push("tmdb-native: no sources");
    } catch (err) {
      warnings.push(`tmdb-native: ${errMessage(err)}`);
    }
  }

  try {
    const vidkingPlay = await resolvePlayableSources(
      {
        ...options,
        backend: "vidking",
        cdnIdentity: "vidking",
        allServers: true,
        firstSuccessOnly: false,
      },
      fetchImpl
    );
    if (hasPlayableSources(vidkingPlay)) {
      const mergedWarnings = [...warnings, ...(vidkingPlay.warnings ?? [])];
      return tagBackend(
        {
          ...vidkingPlay,
          ...baseMeta,
          backend: "auto",
          warnings: mergedWarnings.length ? mergedWarnings : undefined,
        },
        "auto",
        Date.now() - t0
      );
    }
    warnings.push("vidking: no sources");
  } catch (err) {
    warnings.push(`vidking: ${errMessage(err)}`);
  }

  return tagBackend(emptyAutoPlay(options, meta, warnings), "auto", Date.now() - t0);
}

export async function resolveWithBackend(
  options: ResolveOptions,
  fetchImpl: typeof fetch = fetch
): Promise<PlayResponse> {
  const backend = options.backend ?? "auto";

  if (backend === "videasy") {
    const { result, ms } = await timed(() =>
      resolvePlayableSources(
        { ...options, backend: "videasy", cdnIdentity: "videasy" },
        fetchImpl
      )
    );
    return tagBackend(result, "videasy", ms);
  }

  if (backend === "vidking") {
    const { result, ms } = await timed(() =>
      resolvePlayableSources(
        { ...options, backend: "vidking", cdnIdentity: "vidking" },
        fetchImpl
      )
    );
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

  const onlyIds =
    options.onlySourceIds ?? (options.onlySourceId ? [options.onlySourceId] : undefined);
  if (onlyIds?.length === 1 && onlyIds[0] === "videasy") {
    const { result, ms } = await timed(() =>
      resolvePlayableSources(
        { ...options, backend: "videasy", cdnIdentity: "videasy" },
        fetchImpl
      )
    );
    return tagBackend({ ...result, backend: "auto" }, "auto", ms);
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
    raw === "videasy" ||
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
