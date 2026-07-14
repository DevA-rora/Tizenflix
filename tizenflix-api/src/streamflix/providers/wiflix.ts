import * as cheerio from "cheerio";
import type { ContentProvider } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { networkFetch } from "../network/client.js";
import { scrapeEmbedServers } from "./shared/html-scraper.js";
import { extractVideo } from "../extractors/registry.js";

const BASE = "https://flemmix.team/";
const PORTAL = "https://ww1.wiflix-adresses.fun/";

export const wiflixProvider: ContentProvider = {
  id: "wiflix",
  name: "Wiflix",
  language: "fr",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(_tmdbId, _type, meta) {
    const body = new URLSearchParams({
      do: "search",
      subaction: "search",
      story: meta.title,
      search_start: "0",
      full_search: "1",
    }).toString();

    const res = await networkFetch(`${BASE}index.php?do=search`, {
      method: "POST",
      body,
      referer: PORTAL,
      origin: BASE,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      mode: "xhr",
    });

    const $ = cheerio.load(res.text);
    let href: string | null = null;
    $("a[href*='/film/'], a[href*='/serie/']").each((_, el) => {
      const title = $(el).attr("title") ?? $(el).text().trim();
      if (title.toLowerCase().includes(meta.title.toLowerCase().slice(0, 6))) {
        href = $(el).attr("href") ?? null;
        return false;
      }
    });

    if (!href) return null;
    const full = String(href).startsWith("http") ? String(href) : `${BASE}${String(href).replace(/^\//, "")}`;
    return { providerId: "wiflix", contentId: full, title: meta.title };
  },
  async getServers(match, type, season = "1", episode = "1") {
    if (type === "tv") {
      const seasonUrl = `${match.contentId}/season-${season}`;
      const epHtml = await networkFetch(seasonUrl, { referer: BASE });
      const $ = cheerio.load(epHtml.text);
      let epHref: string | null = null;
      $("a[href*='/episode/']").each((_, el) => {
        const t = $(el).text();
        if (t.includes(`E${episode}`) || t.includes(`x${episode}`)) {
          epHref = $(el).attr("href") ?? null;
          return false;
        }
      });
      if (epHref) {
        const ep = String(epHref);
        const full = ep.startsWith("http") ? ep : `${BASE}${ep.replace(/^\//, "")}`;
        return scrapeEmbedServers(full, BASE);
      }
    }
    return scrapeEmbedServers(match.contentId, BASE, ".player-options a, a[href*='embed']");
  },
  async getVideo(server): Promise<ExtractedVideo> {
    return extractVideo(server.src, server.name);
  },
};
