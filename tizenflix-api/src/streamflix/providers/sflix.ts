import * as cheerio from "cheerio";
import type { StreamServer, ExtractedVideo } from "../types.js";
import type { ContentProvider } from "./types.js";
import { BROWSER_UA, fetchJson, fetchText } from "../http.js";
import { extractVideo } from "../extractors/registry.js";

const BASE_URL = "https://sflix.to/";

const SFLIX_HEADERS = {
  Referer: BASE_URL,
  Origin: "https://sflix.to",
  "X-Requested-With": "XMLHttpRequest",
};

interface SflixLinkResponse {
  link: string;
}

export async function findSflixMovieId(tmdbId: string, title: string): Promise<string | null> {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const searchUrl = `${BASE_URL}search/${slug}`;
  const html = await fetchText(searchUrl, { headers: SFLIX_HEADERS });

  const $ = cheerio.load(html);
  let found: string | null = null;

  $("a[href*='/movie/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.endsWith(`-${tmdbId}`) || href.includes(`-${tmdbId}`)) {
      found = href.split("/").pop() || null;
      return false;
    }
  });

  if (found) {
    const movieId = String(found).replace(/^watch-/, "").split("-").pop() || String(found);
    return movieId;
  }

  // Fallback: try ajax list directly with tmdb id (works for many titles)
  try {
    await fetchText(`${BASE_URL}ajax/episode/list/${tmdbId}`, { headers: SFLIX_HEADERS });
    return tmdbId;
  } catch {
    return null;
  }
}

export async function findSflixEpisodeId(
  tmdbId: string,
  title: string,
  season: string,
  episode: string
): Promise<string | null> {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const searchUrl = `${BASE_URL}search/${slug}`;
  const html = await fetchText(searchUrl, { headers: SFLIX_HEADERS });
  const $ = cheerio.load(html);

  let showHref: string | null = null;
  $("a[href*='/tv/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes(`-${tmdbId}`)) {
      showHref = href;
      return false;
    }
  });

  if (!showHref) return null;
  const href = showHref as string;

  const showHtml = await fetchText(`${BASE_URL}${href.replace(/^\//, "")}`, {
    headers: SFLIX_HEADERS,
  });
  const show$ = cheerio.load(showHtml);

  const seasonLinks = await fetchText(
    `${BASE_URL}ajax/season/list/${href.split("-").pop()}`,
    { headers: SFLIX_HEADERS }
  );
  const season$ = cheerio.load(seasonLinks);
  const seasonNum = parseInt(season, 10);
  let seasonId: string | null = null;
  season$(".dropdown-menu a").each((idx, el) => {
    if (idx + 1 === seasonNum) {
      seasonId = season$(el).attr("data-id") || null;
      return false;
    }
  });

  if (!seasonId) return null;

  const epHtml = await fetchText(`${BASE_URL}ajax/season/episodes/${seasonId}`, {
    headers: SFLIX_HEADERS,
  });
  const ep$ = cheerio.load(epHtml);
  const epNum = parseInt(episode, 10);
  let episodeId: string | null = null;
  ep$(".episode-item").each((idx, el) => {
    const num = parseInt(ep$(el).find(".episode-number").text().replace(/\D/g, "") || String(idx + 1), 10);
    if (num === epNum) {
      episodeId = ep$(el).attr("data-id") || null;
      return false;
    }
  });

  return episodeId;
}

export async function getSflixServers(movieOrEpisodeId: string, type: "movie" | "tv"): Promise<StreamServer[]> {
  const path =
    type === "movie"
      ? `${BASE_URL}ajax/episode/list/${movieOrEpisodeId}`
      : `${BASE_URL}ajax/episode/servers/${movieOrEpisodeId}`;

  const html = await fetchText(path, { headers: SFLIX_HEADERS });
  const $ = cheerio.load(html);
  const servers: StreamServer[] = [];

  $("a[data-id]").each((_, el) => {
    const id = $(el).attr("data-id");
    const name = $(el).find("span").text().trim() || "Server";
    if (id) servers.push({ id, name, src: "" });
  });

  if (!servers.length) throw new Error("SFlix: no servers found");
  return servers;
}

export async function getSflixLink(serverId: string): Promise<string> {
  const data = await fetchJson<SflixLinkResponse>(
    `${BASE_URL}ajax/episode/sources/${serverId}`,
    { headers: SFLIX_HEADERS }
  );
  if (!data.link) throw new Error("SFlix: empty embed link");
  return data.link;
}

export async function extractSflixServer(server: StreamServer): Promise<ReturnType<typeof extractVideo>> {
  const link = await getSflixLink(server.id);
  return extractVideo(link, server.name);
}

export const sflixProvider: ContentProvider = {
  id: "sflix",
  name: "SFlix",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(tmdbId, type, meta) {
    const contentId =
      type === "movie"
        ? await findSflixMovieId(tmdbId, meta.title)
        : await findSflixEpisodeId(tmdbId, meta.title, "1", "1");
    if (!contentId) return null;
    return { providerId: "sflix", contentId, title: meta.title };
  },
  async getServers(match, type, season = "1", episode = "1") {
    if (type === "tv" && season && episode) {
      const epId = await findSflixEpisodeId(match.contentId, match.title, season, episode);
      if (epId) return getSflixServers(epId, type);
    }
    return getSflixServers(match.contentId, type);
  },
  async getVideo(server): Promise<ExtractedVideo> {
    return extractSflixServer(server);
  },
};
