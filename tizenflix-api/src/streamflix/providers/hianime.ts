import * as cheerio from "cheerio";
import type { ContentProvider } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { fetchText } from "../network/client.js";
import { extractVideo } from "../extractors/registry.js";

const BASE = "https://hianime.cv/";

type AjaxHtmlResponse = { status?: boolean; html?: string };

async function fetchAjaxHtml(
  url: string,
  options: { referer?: string; mode?: "xhr" | "document" }
): Promise<string> {
  const raw = await fetchText(url, { referer: options.referer, mode: options.mode ?? "xhr" });
  try {
    const parsed = JSON.parse(raw) as AjaxHtmlResponse;
    if (parsed.html) return parsed.html;
  } catch {
    /* plain HTML fallback */
  }
  return raw;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(candidate: string, query: string): boolean {
  const a = normalizeTitle(candidate);
  const b = normalizeTitle(query);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const wa = a.split(" ").filter((w) => w.length > 2);
  const wb = b.split(" ").filter((w) => w.length > 2);
  if (!wa.length || !wb.length) return false;
  const overlap = wa.filter((w) => wb.includes(w)).length;
  return overlap >= Math.min(3, wa.length, wb.length);
}

function searchQueries(title: string): string[] {
  const trimmed = title.trim();
  const words = trimmed.split(/\s+/);
  const out = [trimmed];
  if (words.length > 3) out.push(words.slice(-3).join(" "));
  if (words.length > 2) out.push(words.slice(-2).join(" "));
  return [...new Set(out)];
}

function pickSearchMatch(
  $: cheerio.CheerioAPI,
  type: "movie" | "tv",
  query: string
): string | null {
  let href: string | null = null;
  $("div.flw-item").each((_, el) => {
    const title = $(el).find("h3.film-name").text().trim();
    if (!titlesMatch(title, query)) return;

    const isMovie =
      $(el).find("div.fd-infor > span.fdi-item").last().text().trim() === "Movie";
    if (type === "movie" && !isMovie) return;
    if (type === "tv" && isMovie) return;

    const link = $(el).find("a").attr("href") ?? "";
    if (!link) return;
    href = link.startsWith("http") ? link : `${BASE}${link.replace(/^\//, "")}`;
    return false;
  });
  return href;
}

function showNumericId(contentId: string): string {
  const slug = contentId.replace(/\/$/, "").split("/").pop() ?? contentId;
  const parts = slug.split("-");
  return parts[parts.length - 1] ?? slug;
}

export const hiAnimeProvider: ContentProvider = {
  id: "hianime",
  name: "HiAnime",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(_tmdbId, type, meta) {
    for (const query of searchQueries(meta.title)) {
      const html = await fetchText(`${BASE}search?keyword=${encodeURIComponent(query)}`, {
        referer: BASE,
      });
      const $ = cheerio.load(html);
      const href = pickSearchMatch($, type, meta.title);
      if (href) return { providerId: "hianime", contentId: href, title: meta.title };
    }
    return null;
  },
  async getServers(match, type, _season = "1", episode = "1") {
    const referer = match.contentId;
    let episodeId = "";

    if (type === "movie") {
      const detail = await fetchText(referer, { referer: BASE });
      const $ = cheerio.load(detail);
      const href =
        $("div.ss-list > a.ssl-item.ep-item").first().attr("href") ??
        $("a.ep-item, .ssl-item").first().attr("href") ??
        "";
      episodeId = href.includes("=") ? (href.split("=").pop() ?? "") : "";
    } else {
      const tvId = showNumericId(match.contentId);
      const epHtml = await fetchAjaxHtml(`${BASE}ajax/v2/episode/list/${tvId}`, {
        referer,
      });
      const $ = cheerio.load(epHtml);
      $("div.ss-list > a.ssl-item.ep-item, a.ssl-item.ep-item").each((_, el) => {
        const num =
          $(el).find("div.ssli-order").text().trim() ||
          $(el).attr("data-number") ||
          $(el).text().replace(/\D/g, "");
        if (String(num) !== String(episode)) return;
        const href = $(el).attr("href") ?? "";
        episodeId = href.includes("=") ? (href.split("=").pop() ?? "") : "";
        return false;
      });
    }

    if (!episodeId) throw new Error("HiAnime: episode not found");

    const srvHtml = await fetchAjaxHtml(`${BASE}ajax/v2/episode/servers?episodeId=${episodeId}`, {
      referer,
    });
    const s$ = cheerio.load(srvHtml);
    const servers: StreamServer[] = [];

    s$("div.server-item[data-type][data-id]").each((_, el) => {
      const id = s$(el).attr("data-id");
      if (!id) return;
      const typeName = (s$(el).attr("data-type") ?? "").toUpperCase();
      const label = s$(el).text().trim();
      servers.push({
        id,
        name: typeName ? `${label} - ${typeName}` : label || `Server ${servers.length + 1}`,
        src: id,
        meta: { referer },
      });
    });

    if (!servers.length) throw new Error("HiAnime: no servers found");
    return servers;
  },
  async getVideo(server): Promise<ExtractedVideo> {
    const referer = server.meta?.referer ?? BASE;
    const res = await fetchText(`${BASE}ajax/v2/episode/sources?id=${server.id}`, {
      referer,
      mode: "xhr",
    });
    const data = JSON.parse(res) as { link?: string };
    if (!data.link) throw new Error("HiAnime: no link");
    return extractVideo(data.link, server.name);
  },
};
