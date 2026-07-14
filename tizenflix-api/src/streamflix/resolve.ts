import { detectStreamType, slugify } from "../normalize/detect-type.js";
import { tagPlayableSource } from "../normalize/audio-metadata.js";
import type { PlayResponse } from "../types.js";
import { findProviderById, getEnabledProviders } from "./providers/registry.js";
import { orderProviders, firstAutoProviderId, MAX_AUTO_PROVIDER_ATTEMPTS, AUTO_PROVIDER_TIMEOUT_MS, EN_PROVIDER_ORDER, ANIME_PROVIDER_ORDER } from "./provider-order.js";
import { resolveAnimeProviders } from "./anime-resolve.js";
import type { ContentProvider } from "./providers/types.js";
import type { ExtractedVideo, StreamServer } from "./types.js";
import { getCfBypassUsedInContext, runWithCfContext } from "./network/client.js";

export interface StreamflixResolveOptions {
  type: "movie" | "tv";
  tmdbId: string;
  season?: string;
  episode?: string;
  title: string;
  fetchImpl?: typeof fetch;
  providerTimeoutMs?: number;
  lang?: string;
  isAnime?: boolean;
  providerId?: string;
  preferredProviderId?: string;
  raceProviders?: boolean;
  /** Streamflix-first single provider + capped scan (backend=auto step 1). */
  autoMode?: boolean;
}

export interface ProviderResolveResult {
  provider: string;
  providerId: string;
  ok: boolean;
  ms: number;
  servers: number;
  hls: number;
  subtitles: number;
  cfBypassUsed?: boolean;
  error?: string;
  layer?: "infra" | "network" | "provider" | "extractor";
  entries?: ResolvedEntry[];
}

type ResolvedEntry = {
  serverName: string;
  provider: string;
  providerId: string;
  video: ExtractedVideo;
};

const DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;
const ORDERED_PROVIDER_TIMEOUT_MS = 8_000;

function preferHls(sources: PlayResponse["sources"]): PlayResponse["sources"] {
  const hls = sources.filter((s) => s.type === "m3u8");
  return hls.length ? hls : sources;
}

function toPlayResponse(opts: StreamflixResolveOptions, servers: ResolvedEntry[]): PlayResponse {
  const sources: PlayResponse["sources"] = [];
  const subtitleMap = new Map<string, PlayResponse["subtitles"][0]>();

  for (const entry of servers) {
    const type = detectStreamType(entry.video.source);
    sources.push(
      tagPlayableSource(
        {
          id: `streamflix-${slugify(entry.providerId)}-${slugify(entry.serverName)}-${sources.length}`,
          provider: `${entry.provider}/${entry.serverName}`,
          providerId: entry.providerId,
          label: entry.serverName,
          type,
          url: entry.video.source,
          priority: sources.length,
          upstreamHeaders: entry.video.headers,
        },
        entry.video
      )
    );

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

  const filtered = preferHls(sources);

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
    backend: "streamflix",
  };
}

function dedupeServers(servers: StreamServer[]): StreamServer[] {
  const seen = new Set<string>();
  const out: StreamServer[] = [];
  for (const s of servers) {
    let host = s.src;
    try {
      host = new URL(s.src.startsWith("http") ? s.src : `https://${s.src}`).hostname;
    } catch {
      /* keep raw */
    }
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(s);
  }
  return out;
}

export async function resolveProvider(
  provider: ContentProvider,
  opts: StreamflixResolveOptions,
  timeoutMs: number
): Promise<ProviderResolveResult> {
  const started = Date.now();
  const base: ProviderResolveResult = {
    provider: provider.name,
    providerId: provider.id,
    ok: false,
    ms: 0,
    servers: 0,
    hls: 0,
    subtitles: 0,
  };

  try {
    const result = await Promise.race([
      runWithCfContext(async () => {
        const match = await provider.findByTmdb(opts.tmdbId, opts.type, { title: opts.title });
        if (!match) throw new Error("no TMDB match");

        const servers = dedupeServers(
          await provider.getServers(
            match,
            opts.type,
            opts.season ?? "1",
            opts.episode ?? "1"
          )
        );
        if (!servers.length) throw new Error("no servers");

        const entries: ResolvedEntry[] = [];
        const errors: string[] = [];

        for (const server of servers.slice(0, 6)) {
          try {
            const video = await provider.getVideo(server);
            if (!video.source) continue;
            entries.push({
              serverName: server.name,
              provider: provider.name,
              providerId: provider.id,
              video,
            });
          } catch (err) {
            errors.push(
              `${server.name}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }

        if (!entries.length) {
          throw new Error(errors.join("; ") || "no playable sources");
        }

        return { entries, cfBypassUsed: getCfBypassUsedInContext() };
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("provider timeout")), timeoutMs)
      ),
    ]);

    const hls = result.entries.filter((e) => detectStreamType(e.video.source) === "m3u8").length;
    const subtitles = result.entries.reduce((n, e) => n + e.video.subtitles.length, 0);

    return {
      ...base,
      ok: true,
      ms: Date.now() - started,
      servers: result.entries.length,
      hls,
      subtitles,
      cfBypassUsed: result.cfBypassUsed,
      entries: result.entries,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const layer: ProviderResolveResult["layer"] = msg.includes("Playwright Chromium not installed")
      ? "infra"
      : msg.includes("HTTP")
        ? "network"
        : msg.includes("extractor") || msg.includes("Extractor")
          ? "extractor"
          : "provider";
    return {
      ...base,
      ms: Date.now() - started,
      error: msg,
      layer,
      cfBypassUsed: getCfBypassUsedInContext(),
    };
  }
}

function buildPlayFromResults(
  opts: StreamflixResolveOptions,
  results: ProviderResolveResult[],
  merged: ResolvedEntry[]
): PlayResponse & { providerResults?: ProviderResolveResult[] } {
  const play = toPlayResponse(opts, merged);
  play.providerResults = results;

  const warnings = results
    .filter((r) => !r.ok)
    .map((r) => `${r.provider}: ${r.error}`);
  if (warnings.length) play.warnings = warnings;

  return play;
}

function mergeParallelEntries(successful: ProviderResolveResult[]): ResolvedEntry[] {
  const merged: ResolvedEntry[] = [];
  const seenHosts = new Set<string>();

  for (const r of successful.sort((a, b) => b.hls - a.hls || a.ms - b.ms)) {
    for (const entry of r.entries ?? []) {
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
  }

  return merged;
}

export async function resolveStreamflixSingleProvider(
  opts: StreamflixResolveOptions,
  providerId: string,
  timeoutMs?: number
): Promise<PlayResponse & { providerResults?: ProviderResolveResult[] }> {
  const provider = findProviderById(providerId);
  if (!provider || provider.enabled === false) {
    throw new Error(`Provider not found or disabled: ${providerId}`);
  }

  const ms = timeoutMs ?? opts.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const result = await resolveProvider(provider, opts, ms);

  if (!result.ok || !result.entries?.length) {
    const err = new Error(result.error ?? `${provider.name}: no playable sources`) as Error & {
      providerResults?: ProviderResolveResult[];
    };
    err.providerResults = [result];
    throw err;
  }

  return buildPlayFromResults(opts, [result], result.entries);
}

export async function resolveStreamflixAuto(
  opts: StreamflixResolveOptions
): Promise<PlayResponse & { providerResults?: ProviderResolveResult[] }> {
  const timeoutMs = opts.providerTimeoutMs ?? AUTO_PROVIDER_TIMEOUT_MS;
  const lang = opts.lang ?? "en";
  const isAnime = Boolean(opts.isAnime);
  const enabled = getEnabledProviders(opts.type);
  const ordered = orderProviders(
    enabled,
    lang,
    isAnime,
    opts.preferredProviderId
  );

  const results: ProviderResolveResult[] = [];

  if (isAnime) {
    const raced = await resolveAnimeProviders(opts, timeoutMs);
    if (raced?.sources?.length) return raced;
    if (raced?.providerResults?.length) {
      results.push(...raced.providerResults);
    }
  }

  const tried = new Set<string>();

  const tryProvider = async (provider: ContentProvider): Promise<boolean> => {
    if (tried.has(provider.id)) return false;
    tried.add(provider.id);
    const result = await resolveProvider(provider, opts, timeoutMs);
    results.push(result);
    return Boolean(result.ok && result.entries?.length);
  };

  const firstId = firstAutoProviderId(isAnime, opts.preferredProviderId);
  const first = findProviderById(firstId);
  if (first && first.enabled !== false && (await tryProvider(first))) {
    const last = results[results.length - 1]!;
    return buildPlayFromResults(opts, results, last.entries!);
  }

  for (const provider of ordered) {
    if (results.length >= MAX_AUTO_PROVIDER_ATTEMPTS) break;
    if (await tryProvider(provider)) {
      const last = results[results.length - 1]!;
      return buildPlayFromResults(opts, results, last.entries!);
    }
  }

  const err = new Error(
    results.map((r) => `${r.provider}: ${r.error ?? "unknown"}`).join("; ") || "no providers"
  ) as Error & { providerResults?: ProviderResolveResult[] };
  err.providerResults = results;
  throw err;
}

export async function resolveStreamflixOrdered(
  opts: StreamflixResolveOptions
): Promise<PlayResponse & { providerResults?: ProviderResolveResult[] }> {
  const lang = opts.lang ?? "en";
  const timeoutMs = opts.providerTimeoutMs ?? ORDERED_PROVIDER_TIMEOUT_MS;
  const enabled = getEnabledProviders(opts.type);
  const ordered = orderProviders(
    enabled,
    lang,
    Boolean(opts.isAnime),
    opts.preferredProviderId
  );

  const results: ProviderResolveResult[] = [];

  for (const provider of ordered) {
    const result = await resolveProvider(provider, opts, timeoutMs);
    results.push(result);
    if (result.ok && result.entries?.length) {
      return buildPlayFromResults(opts, results, result.entries);
    }
  }

  const err = new Error(
    results.map((r) => `${r.provider}: ${r.error ?? "unknown"}`).join("; ") || "no providers"
  ) as Error & { providerResults?: ProviderResolveResult[] };
  err.providerResults = results;
  throw err;
}

export async function resolveStreamflixPlayParallel(
  opts: StreamflixResolveOptions
): Promise<PlayResponse & { providerResults?: ProviderResolveResult[] }> {
  const providers = getEnabledProviders(opts.type);
  const timeoutMs = opts.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

  const results = await Promise.all(
    providers.map((p) => resolveProvider(p, opts, timeoutMs))
  );

  const successful = results.filter((r) => r.ok && r.entries?.length);
  const merged = mergeParallelEntries(successful);
  const play = buildPlayFromResults(opts, results, merged);

  if (!merged.length) {
    const err = new Error(
      results.map((r) => `${r.provider}: ${r.error ?? "unknown"}`).join("; ")
    ) as Error & { providerResults?: typeof results };
    err.providerResults = results;
    throw err;
  }

  return play;
}

export async function resolveStreamflixPlay(
  opts: StreamflixResolveOptions
): Promise<PlayResponse & { providerResults?: ProviderResolveResult[] }> {
  if (opts.providerId) {
    return resolveStreamflixSingleProvider(opts, opts.providerId);
  }
  if (opts.raceProviders) {
    return resolveStreamflixPlayParallel(opts);
  }
  if (opts.isAnime && !opts.autoMode) {
    const timeoutMs = opts.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    const raced = await resolveAnimeProviders(opts, timeoutMs);
    if (raced?.sources?.length) return raced;
  }
  if (opts.autoMode) {
    return resolveStreamflixAuto(opts);
  }
  return resolveStreamflixOrdered(opts);
}

/** @deprecated use resolveStreamflixPlayParallel */
export { resolveStreamflixPlayParallel as resolveStreamflixPlayRace };

export async function resolveStreamflixFromOptions(
  options: import("../types.js").ResolveOptions & { title?: string },
  fetchImpl: typeof fetch = fetch
): Promise<PlayResponse> {
  const { fetchMetadata } = await import("../api/metadata.js");
  const { isAnime } = await import("../tmdb/is-anime.js");
  const meta = await fetchMetadata(options.type, options.tmdbId, fetchImpl);
  const anime = options.isAnime ?? isAnime(meta);

  return resolveStreamflixPlay({
    type: options.type,
    tmdbId: options.tmdbId,
    season: options.season,
    episode: options.episode,
    title: meta.title,
    fetchImpl,
    lang: options.lang,
    isAnime: anime,
    providerId: options.providerId,
    preferredProviderId: options.preferredProviderId,
    raceProviders: options.raceProviders,
    autoMode: options.autoMode,
    providerTimeoutMs: options.sourceTimeoutMs,
  });
}

export { EN_PROVIDER_ORDER, ANIME_PROVIDER_ORDER, firstAutoProviderId, MAX_AUTO_PROVIDER_ATTEMPTS, AUTO_PROVIDER_TIMEOUT_MS };
