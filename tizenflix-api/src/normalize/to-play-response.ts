import { SERVER_PRIORITY } from "../constants/servers.js";
import { fetchMetadata } from "../api/metadata.js";
import { fetchServerSources, fetchServerSourcesDirect } from "../api/sources.js";
import { detectStreamType, slugify } from "./detect-type.js";
import type {
  DecryptedSourceResponse,
  MediaType,
  PlayResponse,
  PlayableSource,
  ResolveOptions,
  ServerResult,
  SubtitleTrack,
} from "../types.js";

function normalizeSubtitles(
  tracks: SubtitleTrack[] | undefined,
  _tmdbId: string
): PlayResponse["subtitles"] {
  if (!tracks?.length) return [];
  const seen = new Set<string>();
  const out: PlayResponse["subtitles"] = [];

  for (const t of tracks) {
    if (!t.url && !t.file) continue;
    const lang = String(t.language ?? t.label ?? "und");
    const url = String(t.url ?? t.file ?? "");
    const key = `${slugify(lang)}::${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `sub-${slugify(lang)}-${out.length}`,
      language: lang,
      label: String(t.label ?? lang),
      url,
      default: out.length === 0,
    });
  }
  return out;
}

function sourcesFromServer(
  serverName: string,
  data: DecryptedSourceResponse,
  priorityBase: number
): PlayableSource[] {
  const out: PlayableSource[] = [];
  const sources = data.sources ?? [];
  for (const s of sources) {
    if (!s?.url) continue;
    const quality = s.quality ?? "Auto";
    const type = detectStreamType(s.url);
    const id = `${slugify(serverName)}-${slugify(quality)}-${out.length}`;
    out.push({
      id,
      provider: serverName,
      label: quality,
      type,
      url: s.url,
      priority: priorityBase + out.length,
    });
  }
  return out;
}

export function mergeServerResults(
  type: MediaType,
  tmdbId: string,
  results: ServerResult[],
  season?: string,
  episode?: string,
  title?: string
): PlayResponse {
  const allSources: PlayableSource[] = [];
  let subtitles: PlayResponse["subtitles"] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (!r.data) continue;
    allSources.push(...sourcesFromServer(r.server, r.data, i * 100));
    if (!subtitles.length && r.data.subtitles?.length) {
      subtitles = normalizeSubtitles(r.data.subtitles, tmdbId);
    }
  }

  allSources.sort((a, b) => a.priority - b.priority);

  return {
    title,
    type,
    tmdbId,
    season,
    episode,
    sources: allSources,
    recommended: allSources[0]?.id ?? null,
    subtitles,
    nextEpisode:
      type === "tv" && season && episode
        ? { season, episode: String(parseInt(episode, 10) + 1) }
        : null,
  };
}

export async function resolvePlayableSources(
  options: ResolveOptions,
  fetchImpl: typeof fetch = fetch
): Promise<PlayResponse> {
  const {
    type,
    tmdbId,
    season = "1",
    episode = "1",
    server,
    allServers = false,
    firstSuccessOnly = !allServers && !server,
  } = options;

  const meta = await fetchMetadata(type, tmdbId, fetchImpl);
  const results: ServerResult[] = [];

  const serversToTry = server
    ? [server]
    : allServers
      ? SERVER_PRIORITY
      : SERVER_PRIORITY;

  for (const serverName of serversToTry) {
    try {
      const data = server
        ? await fetchServerSources(
            serverName,
            {
              mediaType: type,
              tmdbId,
              seasonId: season,
              episodeId: episode,
              title: meta.title,
              year: meta.year,
              imdbId: meta.imdbId,
              timestamp: String(Date.now()),
            },
            fetchImpl
          )
        : await fetchServerSourcesDirect(
            serverName,
            type,
            tmdbId,
            meta,
            season,
            episode,
            fetchImpl
          );

      if (data) {
        results.push({ server: serverName, data });
        if (firstSuccessOnly) break;
      } else {
        results.push({
          server: serverName,
          data: null,
          error: "No sources returned",
        });
      }
    } catch (err) {
      results.push({
        server: serverName,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
      if (server) throw err;
    }
  }

  const play = mergeServerResults(
    type,
    tmdbId,
    results,
    type === "tv" ? season : undefined,
    type === "tv" ? episode : undefined,
    meta.title
  );

  if (!play.sources.length) {
    const errors = results
      .map((r) => r.error)
      .filter(Boolean)
      .join("; ");
    throw new Error(
      errors || "No playable sources found from any server"
    );
  }

  return play;
}

export async function listProviders(): Promise<
  Array<{ id: string; name: string; endpoint: string; status: string }>
> {
  const { getActiveServers } = await import("../constants/servers.js");
  return getActiveServers().map((s) => ({
    id: slugify(s.name),
    name: s.name,
    endpoint: s.endpoint,
    status: "unknown",
  }));
}
