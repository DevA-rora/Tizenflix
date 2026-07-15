import { SERVER_PRIORITY, TIZEN_SERVER_PRIORITY, API_BASE } from "../constants/servers.js";
import { videasyServerPriorityFor } from "../constants/videasy-servers.js";
import { fetchMetadata } from "../api/metadata.js";
import { fetchSeed } from "../api/seed.js";
import { fetchServerSources, fetchServerSourcesDirect } from "../api/sources.js";
import { detectStreamType, slugify } from "./detect-type.js";
import { tagPlayableSource } from "./audio-metadata.js";
import { defaultUpstreamHeadersForProvider } from "../proxy/proxy-header-options.js";
import type {
  CdnIdentity,
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
  priorityBase: number,
  identity: CdnIdentity
): PlayableSource[] {
  const out: PlayableSource[] = [];
  const sources = data.sources ?? [];
  for (const s of sources) {
    if (!s?.url) continue;
    const quality = s.quality ?? "Auto";
    const type = detectStreamType(s.url);
    const id = `${slugify(serverName)}-${slugify(quality)}-${out.length}`;
    out.push(
      tagPlayableSource({
        id,
        provider: serverName,
        label: quality,
        type,
        url: s.url,
        priority: priorityBase + out.length,
        audioVariant: "unknown",
        sourceId: identity === "videasy" ? "videasy" : undefined,
        upstreamHeaders: defaultUpstreamHeadersForProvider(serverName),
      })
    );
  }
  return out;
}

export function mergeServerResults(
  type: MediaType,
  tmdbId: string,
  results: ServerResult[],
  season?: string,
  episode?: string,
  title?: string,
  imdbId?: string,
  identity: CdnIdentity = "vidking"
): PlayResponse {
  const allSources: PlayableSource[] = [];
  let subtitles: PlayResponse["subtitles"] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (!r.data) continue;
    allSources.push(...sourcesFromServer(r.server, r.data, i * 100, identity));
    if (!subtitles.length && r.data.subtitles?.length) {
      subtitles = normalizeSubtitles(r.data.subtitles, tmdbId);
    }
  }

  allSources.sort((a, b) => a.priority - b.priority);

  return {
    title,
    imdbId,
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

function sortServersForProfile(
  names: string[],
  profile: ResolveOptions["profile"],
  providerScore?: (provider: string) => number,
  tizenOrder: string[] = TIZEN_SERVER_PRIORITY
): string[] {
  if (profile !== "tizen") {
    if (!providerScore) return names;
    return names.slice().sort((a, b) => {
      const scoreA = providerScore(a) ?? 0.5;
      const scoreB = providerScore(b) ?? 0.5;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return names.indexOf(a) - names.indexOf(b);
    });
  }

  const baseOrder = tizenOrder.filter((n) => names.includes(n));
  for (const n of names) {
    if (baseOrder.indexOf(n) === -1) baseOrder.push(n);
  }

  if (!providerScore) return baseOrder;

  return baseOrder.slice().sort((a, b) => {
    const scoreA = providerScore(a) ?? 0.5;
    const scoreB = providerScore(b) ?? 0.5;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return baseOrder.indexOf(a) - baseOrder.indexOf(b);
  });
}

function serverListForOptions(options: ResolveOptions, identity: CdnIdentity): string[] {
  if (options.server) return [options.server];
  if (identity === "videasy") {
    return videasyServerPriorityFor({
      profile: options.profile,
      mediaType: options.type,
      lang: options.lang,
    });
  }
  return [...SERVER_PRIORITY];
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
    profile,
    providerScore,
  } = options;

  const identity: CdnIdentity =
    options.cdnIdentity ?? (options.backend === "videasy" ? "videasy" : "vidking");
  const fetchOpts = { identity };

  const meta = await fetchMetadata(type, tmdbId, fetchImpl);
  // Warm seed cache once so allServers parallel fan-out does not stampede /seed (429).
  try {
    await fetchSeed(tmdbId, API_BASE, fetchImpl, identity);
  } catch {
    /* individual server fetches will surface seed errors */
  }
  const results: ServerResult[] = [];

  const priorityNames = serverListForOptions(options, identity);
  const tizenOrder =
    identity === "videasy"
      ? videasyServerPriorityFor({ profile: "tizen", mediaType: type, lang: options.lang })
      : TIZEN_SERVER_PRIORITY;

  const serversToTry = sortServersForProfile(
    priorityNames,
    profile,
    providerScore,
    tizenOrder
  );

  const fetchOne = async (serverName: string): Promise<ServerResult> => {
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
            fetchImpl,
            fetchOpts
          )
        : await fetchServerSourcesDirect(
            serverName,
            type,
            tmdbId,
            meta,
            season,
            episode,
            fetchImpl,
            fetchOpts
          );

      if (data) {
        return { server: serverName, data };
      }
      return {
        server: serverName,
        data: null,
        error: "No sources returned",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (server) throw err;
      return { server: serverName, data: null, error: message };
    }
  };

  if (server) {
    results.push(await fetchOne(server));
  } else if (allServers) {
    const settled = await Promise.all(serversToTry.map((name) => fetchOne(name)));
    results.push(...settled);
  } else {
    for (const serverName of serversToTry) {
      const result = await fetchOne(serverName);
      results.push(result);
      if (firstSuccessOnly && result.data?.sources?.length) break;
    }
  }

  const play = mergeServerResults(
    type,
    tmdbId,
    results,
    type === "tv" ? season : undefined,
    type === "tv" ? episode : undefined,
    meta.title,
    meta.imdbId,
    identity
  );

  if (!play.sources.length) {
    const errors = results
      .map((r) => r.error)
      .filter(Boolean)
      .join("; ");
    const message = errors || "No playable sources found from any server";
    if (server) {
      throw new Error(message);
    }
    return {
      ...play,
      sources: [],
      recommended: null,
      warnings: [message],
    };
  }

  return play;
}

export async function listProviders(): Promise<
  Array<{ id: string; name: string; endpoint: string; status: string }>
> {
  const { getActiveServers } = await import("../constants/servers.js");
  const { getActiveVideasyServers } = await import("../constants/videasy-servers.js");
  const vidking = getActiveServers().map((s) => ({
    id: slugify(s.name),
    name: s.name,
    endpoint: s.endpoint,
    status: "unknown",
  }));
  const videasy = getActiveVideasyServers({ mediaType: "movie", lang: "en" }).map((s) => ({
    id: `videasy-${slugify(s.name)}`,
    name: `${s.name} (Videasy)`,
    endpoint: s.endpoint,
    status: "unknown",
  }));
  return [...videasy, ...vidking];
}
