import * as cheerio from "cheerio";
import type { ContentProvider, ProviderMatch } from "../types.js";
import type { ExtractedVideo, StreamServer } from "../../types.js";
import { fetchText } from "../../http.js";
import { extractVideo } from "../../extractors/registry.js";

export interface HtmlProviderConfig {
  id: string;
  name: string;
  language: string;
  baseUrl: string;
  supportsMovies: boolean;
  supportsTv: boolean;
  implementationStatus?: "full" | "partial" | "stub";
  requiresPlaywright?: boolean;
  /** Build search URL from title */
  searchPath: (title: string, type: "movie" | "tv") => string;
  /** Parse search results → content paths or ids */
  parseSearch: (html: string, title: string, type: "movie" | "tv") => Array<{ id: string; title: string; href: string }>;
  getServers: (
    match: ProviderMatch,
    type: "movie" | "tv",
    season: string,
    episode: string
  ) => Promise<StreamServer[]>;
}

export function createHtmlProvider(cfg: HtmlProviderConfig): ContentProvider {
  return {
    id: cfg.id,
    name: cfg.name,
    language: cfg.language,
    supportsMovies: cfg.supportsMovies,
    supportsTv: cfg.supportsTv,
    enabled: true,
    implementationStatus: cfg.implementationStatus ?? "partial",
    requiresPlaywright: cfg.requiresPlaywright ?? false,
    async findByTmdb(tmdbId, type, meta) {
      const url = cfg.searchPath(meta.title, type);
      const html = await fetchText(url.startsWith("http") ? url : `${cfg.baseUrl}${url}`, {
        referer: cfg.baseUrl,
        origin: cfg.baseUrl,
      });
      const results = cfg.parseSearch(html, meta.title, type);
      const norm = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const match =
        results.find((r) => r.title.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(norm)) ??
        results[0];
      if (!match) return null;
      return {
        providerId: cfg.id,
        contentId: match.id,
        title: match.title,
        meta: { href: match.href, tmdbId },
      };
    },
    getServers: (match, type, season, episode) => cfg.getServers(match, type, season ?? "1", episode ?? "1"),
    async getVideo(server: StreamServer): Promise<ExtractedVideo> {
      return extractVideo(server.src, server.name);
    },
  };
}

/** Default embed link scraper from a detail/watch page */
export async function scrapeEmbedServers(
  pageUrl: string,
  baseUrl: string,
  selectors = "a[href*='embed'], iframe[src], li[data-link], .server-item a"
): Promise<StreamServer[]> {
  const html = await fetchText(pageUrl, { referer: baseUrl, origin: baseUrl });
  const $ = cheerio.load(html);
  const servers: StreamServer[] = [];
  $(selectors).each((i, el) => {
    const href = $(el).attr("href") ?? $(el).attr("data-src") ?? $(el).attr("src") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    const src = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    servers.push({ id: String(i), name: $(el).text().trim() || `Server ${i + 1}`, src });
  });
  return servers;
}

/** Simple card parser for search pages */
export function parseCardSearch(
  html: string,
  baseUrl: string,
  cardSelector: string,
  linkSelector: string
): Array<{ id: string; title: string; href: string }> {
  const $ = cheerio.load(html);
  const out: Array<{ id: string; title: string; href: string }> = [];
  $(cardSelector).each((_, el) => {
    const link = $(el).find(linkSelector).first();
    const href = link.attr("href") ?? "";
    const title = link.attr("title") ?? link.text().trim();
    if (!href || !title) return;
    const full = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    out.push({ id: full, title, href: full });
  });
  return out;
}
