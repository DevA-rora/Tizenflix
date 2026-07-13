import * as cheerio from "cheerio";
import type { StreamServer, ExtractedVideo } from "../types.js";
import type { ContentProvider } from "./types.js";
import { fetchJson, fetchText } from "../network/client.js";
import { extractVideo } from "../extractors/registry.js";

const BASE_URL = "https://ridomovies.tv/";

const RIDO_HEADERS = {
  Accept: "application/json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Platform: "android",
  Referer: BASE_URL,
  Origin: "https://ridomovies.tv",
};

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface SearchItem {
  id: string;
  type: string;
  slug: string;
  title: string;
  contentable: {
    tmdbId: number;
    overview?: string;
    releaseDate?: string;
    duration?: number;
    apiPosterPath?: string;
    apiBackdropPath?: string;
  };
}

interface VideoEntry {
  id: string;
  quality: string;
  url: string;
}

interface SeasonEntry {
  id: string;
  seasonNumber: string;
}

interface EpisodeEntry {
  id: string;
  episodeNumber: number;
  title: string;
}

async function searchByTmdb(tmdbId: string, title: string): Promise<SearchItem | null> {
  const response = await fetchJson<ApiResponse<{ items: SearchItem[] }>>(
    `${BASE_URL}core/api/search?q=${encodeURIComponent(title)}&page[number]=1`,
    { referer: BASE_URL, mode: "json", headers: RIDO_HEADERS }
  );

  const exact = response.data.items.find(
    (item) => String(item.contentable.tmdbId) === String(tmdbId)
  );
  if (exact) return exact;

  return response.data.items[0] ?? null;
}

function parseIframeSrc(urlHtml: string): string | null {
  const $ = cheerio.load(urlHtml);
  return $("iframe").attr("data-src") ?? $("iframe").attr("src") ?? null;
}

export async function getRidomoviesServers(
  slug: string,
  type: "movie" | "tv",
  episodeId?: string
): Promise<StreamServer[]> {
  const path =
    type === "movie"
      ? `${BASE_URL}api/movies/${slug}`
      : `${BASE_URL}api/episodes/${episodeId}`;

  const response = await fetchJson<ApiResponse<VideoEntry[]>>(path, {
    referer: BASE_URL,
    mode: "json",
    headers: RIDO_HEADERS,
  });
  const servers: StreamServer[] = [];

  for (const entry of response.data) {
    const src = parseIframeSrc(entry.url);
    if (!src) continue;
    servers.push({
      id: entry.id,
      name: entry.quality || "Server",
      src,
    });
  }

  if (!servers.length) throw new Error("Ridomovies: no embed servers found");
  return servers;
}

export async function resolveRidomoviesEpisodeId(
  slug: string,
  season: string,
  episode: string
): Promise<string> {
  const seasonsRes = await fetchJson<ApiResponse<{ items: SeasonEntry[] }>>(
    `${BASE_URL}core/api/series/${slug}/seasons`,
    { referer: BASE_URL, mode: "json", headers: RIDO_HEADERS }
  );

  const seasonNum = parseInt(season, 10);
  const seasonEntry = seasonsRes.data.items.find(
    (s) => parseInt(s.seasonNumber, 10) === seasonNum
  );
  if (!seasonEntry) throw new Error(`Ridomovies: season ${season} not found`);

  const episodesRes = await fetchJson<ApiResponse<{ items: EpisodeEntry[] }>>(
    `${BASE_URL}core/api/series/${slug}/seasons/${seasonEntry.id}/episodes`,
    { referer: BASE_URL, mode: "json", headers: RIDO_HEADERS }
  );

  const epNum = parseInt(episode, 10);
  const epEntry = episodesRes.data.items.find((e) => e.episodeNumber === epNum);
  if (!epEntry) throw new Error(`Ridomovies: episode ${episode} not found`);

  return epEntry.id;
}

export async function extractRidomoviesServer(server: StreamServer) {
  return extractVideo(server.src, server.name);
}

export async function findRidomoviesContent(
  tmdbId: string,
  title: string,
  type: "movie" | "tv"
): Promise<{ slug: string; type: "movie" | "tv-series" } | null> {
  const item = await searchByTmdb(tmdbId, title);
  if (!item) return null;

  const itemType = item.type === "movie" ? "movie" : "tv-series";
  if (type === "movie" && itemType !== "movie") return null;
  if (type === "tv" && itemType !== "tv-series") return null;

  return { slug: item.slug, type: itemType };
}

/** Verify ridomovies is reachable */
export async function pingRidomovies(): Promise<boolean> {
  try {
    await fetchText(`${BASE_URL}home`, { referer: BASE_URL, mode: "document", timeoutMs: 10_000 });
    return true;
  } catch {
    return false;
  }
}

export const ridomoviesProvider: ContentProvider = {
  id: "ridomovies",
  name: "Ridomovies",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(tmdbId, type, meta) {
    const content = await findRidomoviesContent(tmdbId, meta.title, type);
    if (!content) return null;
    return {
      providerId: "ridomovies",
      contentId: content.slug,
      title: meta.title,
      slug: content.slug,
      meta: { itemType: content.type },
    };
  },
  async getServers(match, type, season = "1", episode = "1") {
    let episodeId: string | undefined;
    if (type === "tv") {
      episodeId = await resolveRidomoviesEpisodeId(match.contentId, season, episode);
    }
    return getRidomoviesServers(
      match.contentId,
      type,
      episodeId
    );
  },
  async getVideo(server): Promise<ExtractedVideo> {
    return extractRidomoviesServer(server);
  },
};
