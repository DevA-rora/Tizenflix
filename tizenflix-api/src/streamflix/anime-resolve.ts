import type { PlayResponse } from "../types.js";
import { detectStreamType, slugify } from "../normalize/detect-type.js";
import { tagPlayableSource } from "../normalize/audio-metadata.js";
import { findProviderById } from "./providers/registry.js";
import {
  resolveProvider,
  type ProviderResolveResult,
  type StreamflixResolveOptions,
} from "./resolve.js";

export const ANIME_PROVIDER_IDS = ["hianime", "ani-world", "anikoto", "anime-world"] as const;

const DEFAULT_ANIME_RACE_TIMEOUT_MS = 12_000;

type ResolvedEntry = NonNullable<ProviderResolveResult["entries"]>[number];

function entriesToPlayResponse(
  opts: StreamflixResolveOptions,
  entries: ResolvedEntry[]
): PlayResponse {
  const sources: PlayResponse["sources"] = [];
  const subtitleMap = new Map<string, PlayResponse["subtitles"][0]>();

  for (const entry of entries) {
    const type = detectStreamType(entry.video.source);
    if (type !== "m3u8") continue;
    sources.push(
      tagPlayableSource(
        {
          id: `anime-${slugify(entry.providerId || entry.provider)}-${slugify(entry.serverName)}-${sources.length}`,
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

  return {
    title: opts.title,
    type: opts.type,
    tmdbId: opts.tmdbId,
    season: opts.type === "tv" ? opts.season : undefined,
    episode: opts.type === "tv" ? opts.episode : undefined,
    sources,
    recommended: sources[0]?.id ?? null,
    subtitles: Array.from(subtitleMap.values()),
    nextEpisode:
      opts.type === "tv" && opts.season && opts.episode
        ? { season: opts.season, episode: String(parseInt(opts.episode, 10) + 1) }
        : null,
    backend: "auto",
  };
}

/** Race anime scraper providers — first HLS success wins. */
export async function resolveAnimeProviders(
  opts: StreamflixResolveOptions,
  raceTimeoutMs: number = DEFAULT_ANIME_RACE_TIMEOUT_MS
): Promise<(PlayResponse & { providerResults?: ProviderResolveResult[] }) | null> {
  const providers = ANIME_PROVIDER_IDS.map((id) => findProviderById(id)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p && p.enabled !== false)
  );

  if (!providers.length) return null;

  const perProviderTimeout = raceTimeoutMs;
  const inFlight = providers.map((p) => resolveProvider(p, opts, perProviderTimeout));

  const winner = await new Promise<ProviderResolveResult | null>((resolve) => {
    let settled = false;
    let pending = inFlight.length;

    const finish = (result: ProviderResolveResult | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), raceTimeoutMs);

    for (const p of inFlight) {
      p.then((result) => {
        if (!settled && result.ok && result.hls > 0 && result.entries?.length) {
          finish(result);
          return;
        }
        pending -= 1;
        if (pending === 0) finish(null);
      }).catch(() => {
        pending -= 1;
        if (pending === 0) finish(null);
      });
    }
  });

  const results = await Promise.all(inFlight);

  if (winner?.entries?.length) {
    const hlsEntries = winner.entries.filter(
      (e) => detectStreamType(e.video.source) === "m3u8"
    );
    if (!hlsEntries.length) return null;
    const play = entriesToPlayResponse(opts, hlsEntries);
    play.providerResults = results;
    const warnings = results
      .filter((r) => !r.ok)
      .map((r) => `${r.provider}: ${r.error}`);
    if (warnings.length) play.warnings = warnings;
    return play;
  }

  return null;
}
