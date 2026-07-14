import * as cheerio from "cheerio";
import type { ContentProvider, ProviderMatch } from "../types.js";
import type { ExtractedVideo, StreamServer } from "../../types.js";
import { fetchText } from "../../http.js";
import { extractVideo } from "../../extractors/registry.js";
import { scrapeEmbedServers, parseCardSearch } from "./html-scraper.js";

export interface SearchHtmlConfig {
  id: string;
  name: string;
  language: string;
  baseUrl: string;
  supportsMovies: boolean;
  supportsTv: boolean;
  searchPath: (title: string, type: "movie" | "tv") => string;
  cardSelector?: string;
  linkSelector?: string;
  /** Build episode page URL from match + season/episode */
  episodePath?: (match: ProviderMatch, season: string, episode: string) => string;
  embedSelectors?: string;
  requiresPlaywright?: boolean;
}

export function createSearchHtmlProvider(cfg: SearchHtmlConfig): ContentProvider {
  const cardSel = cfg.cardSelector ?? ".item, .post, article, .flw-item, .film-item";
  const linkSel = cfg.linkSelector ?? "a";

  return {
    id: cfg.id,
    name: cfg.name,
    language: cfg.language,
    supportsMovies: cfg.supportsMovies,
    supportsTv: cfg.supportsTv,
    enabled: true,
    implementationStatus: "full",
    requiresPlaywright: cfg.requiresPlaywright,
    async findByTmdb(_tmdbId, type, meta) {
      const path = cfg.searchPath(meta.title, type);
      const url = path.startsWith("http") ? path : `${cfg.baseUrl}${path}`;
      const html = await fetchText(url, { referer: cfg.baseUrl, origin: cfg.baseUrl });
      const cards = parseCardSearch(html, cfg.baseUrl, cardSel, linkSel);
      const norm = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const match =
        cards.find((c) => c.title.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(norm.slice(0, 6))) ??
        cards[0];
      if (!match) return null;
      return { providerId: cfg.id, contentId: match.href, title: match.title, meta: { href: match.href } };
    },
    async getServers(match, type, season = "1", episode = "1") {
      let pageUrl = match.contentId;
      if (type === "tv" && cfg.episodePath) {
        pageUrl = cfg.episodePath(match, season, episode);
      } else if (type === "tv") {
        const html = await fetchText(match.contentId, { referer: cfg.baseUrl });
        const $ = cheerio.load(html);
        const epLink = $(`a[href*="episode"], a[href*="capitulo"], a[href*="episodio"]`)
          .filter((_, el) => {
            const t = $(el).text();
            return t.includes(episode) || t.includes(`E${episode}`) || t.includes(`x${episode}`);
          })
          .first()
          .attr("href");
        if (epLink) pageUrl = epLink.startsWith("http") ? epLink : new URL(epLink, cfg.baseUrl).href;
      }
      return scrapeEmbedServers(pageUrl, cfg.baseUrl, cfg.embedSelectors);
    },
    async getVideo(server): Promise<ExtractedVideo> {
      return extractVideo(server.src, server.name);
    },
  };
}
