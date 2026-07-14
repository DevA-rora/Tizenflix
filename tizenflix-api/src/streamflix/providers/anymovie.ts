import * as cheerio from "cheerio";
import type { ContentProvider } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { fetchText } from "../http.js";
import { scrapeEmbedServers } from "./shared/html-scraper.js";
import { extractVideo } from "../extractors/registry.js";

const BASE = "https://anymovie.cc/";

export const anyMovieProvider: ContentProvider = {
  id: "anymovie",
  name: "AnyMovie",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(_tmdbId, _type, meta) {
    const html = await fetchText(`${BASE}?s=${encodeURIComponent(meta.title)}`, { referer: BASE });
    const $ = cheerio.load(html);
    let href: string | null = null;
    $("article a[href], .post-title a").each((_, el) => {
      const title = $(el).text().trim();
      if (title.toLowerCase().includes(meta.title.toLowerCase().slice(0, 6))) {
        href = $(el).attr("href") ?? null;
        return false;
      }
    });
    if (!href) return null;
    return { providerId: "anymovie", contentId: href, title: meta.title };
  },
  async getServers(match) {
    return scrapeEmbedServers(match.contentId, BASE, "a.link-server, iframe[src], .server-item");
  },
  async getVideo(server): Promise<ExtractedVideo> {
    return extractVideo(server.src, server.name);
  },
};
