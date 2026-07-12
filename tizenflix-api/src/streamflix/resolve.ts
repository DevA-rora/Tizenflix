import { detectStreamType, slugify } from "../normalize/detect-type.js";
import type { PlayResponse } from "../types.js";
import { getEnabledProviders } from "./providers/registry.js";
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
  video: ExtractedVideo;
};

const DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;

function preferHls(sources: PlayResponse["sources"]): PlayResponse["sources"] {
  const hls = sources.filter((s) => s.type === "m3u8");
  return hls.length ? hls : sources;
}

function toPlayResponse(opts: StreamflixResolveOptions, servers: ResolvedEntry[]): PlayResponse {
  const sources: PlayResponse["sources"] = [];
  const subtitleMap = new Map<string, PlayResponse["subtitles"][0]>();

  for (const entry of servers) {
    const type = detectStreamType(entry.video.source);
    sources.push({
      id: `streamflix-${slugify(entry.provider)}-${slugify(entry.serverName)}-${sources.length}`,
      provider: `${entry.provider}/${entry.serverName}`,
      label: entry.serverName,
      type,
      url: entry.video.source,
      priority: sources.length,
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

async function resolveProvider(
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
            entries.push({ serverName: server.name, provider: provider.name, video });
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

export async function resolveStreamflixPlay(
  opts: StreamflixResolveOptions
): Promise<PlayResponse & { providerResults?: ProviderResolveResult[] }> {
  const providers = getEnabledProviders(opts.type);
  const timeoutMs = opts.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

  const results = await Promise.all(
    providers.map((p) => resolveProvider(p, opts, timeoutMs))
  );

  const successful = results.filter((r) => r.ok && r.entries?.length);
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

  const play = toPlayResponse(opts, merged);
  play.providerResults = results;

  const warnings = results
    .filter((r) => !r.ok)
    .map((r) => `${r.provider}: ${r.error}`);
  if (warnings.length) play.warnings = warnings;

  if (!merged.length) {
    const err = new Error(
      results.map((r) => `${r.provider}: ${r.error ?? "unknown"}`).join("; ")
    ) as Error & { providerResults?: typeof results };
    err.providerResults = results;
    throw err;
  }

  return play;
}

export async function resolveStreamflixFromOptions(
  options: import("../types.js").ResolveOptions & { title?: string },
  fetchImpl: typeof fetch = fetch
): Promise<PlayResponse> {
  const { fetchMetadata } = await import("../api/metadata.js");
  const meta = await fetchMetadata(options.type, options.tmdbId, fetchImpl);

  return resolveStreamflixPlay({
    type: options.type,
    tmdbId: options.tmdbId,
    season: options.season,
    episode: options.episode,
    title: meta.title,
    fetchImpl,
  });
}
