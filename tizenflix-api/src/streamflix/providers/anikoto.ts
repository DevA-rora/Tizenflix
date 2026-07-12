import * as cheerio from "cheerio";
import type { ContentProvider } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { fetchText, fetchJson } from "../network/client.js";
import { extractVideo } from "../extractors/registry.js";

const BASE = "https://anikototv.to/";

async function searchAnikoto(title: string): Promise<string | null> {
  const html = await fetchText(
    `${BASE}filter?keyword=${encodeURIComponent(title)}&page=1`,
    { referer: BASE, origin: BASE }
  );
  const $ = cheerio.load(html);
  let found: string | null = null;
  $(".item a[href*='/watch/'], .flw-item a[href*='/watch/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const name = $(el).find(".name, .film-name").text().trim() || $(el).attr("title") || "";
    if (name.toLowerCase().includes(title.toLowerCase().slice(0, 8))) {
      found = href.startsWith("http") ? href : `${BASE}${href.replace(/^\//, "")}`;
      return false;
    }
  });
  return found;
}

export const anikotoProvider: ContentProvider = {
  id: "anikoto",
  name: "Anikoto",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(_tmdbId, type, meta) {
    const href = await searchAnikoto(meta.title);
    if (!href) return null;
    return { providerId: "anikoto", contentId: href, title: meta.title };
  },
  async getServers(match, type, season = "1", episode = "1") {
    const page = await fetchText(match.contentId, { referer: BASE });
    const $ = cheerio.load(page);
    let episodeToken = "";

    if (type === "movie") {
      episodeToken = $("a.ep-item, .ssl-item").first().attr("data-id") ?? "";
    } else {
      $(`a.ep-item, .ssl-item`).each((_, el) => {
        const num = $(el).attr("data-number") ?? $(el).text().replace(/\D/g, "");
        if (num === episode) {
          episodeToken = $(el).attr("data-id") ?? "";
          return false;
        }
      });
    }

    if (!episodeToken) throw new Error("Anikoto: episode not found");

    const res = await fetchJson<{ result?: string }>(
      `${BASE}ajax/episode/servers/${episodeToken}`,
      { referer: match.contentId, origin: BASE, mode: "xhr" }
    );
    const doc = cheerio.load(res.result ?? "");
    const servers: StreamServer[] = [];
    doc(".servers .type").each((_, typeEl) => {
      const typeName = doc(typeEl).attr("data-type")?.toUpperCase() ?? "";
      doc(typeEl)
        .find("li[data-link-id]")
        .each((i, li) => {
          const linkId = doc(li).attr("data-link-id");
          if (!linkId) return;
          servers.push({
            id: `${linkId}|${match.contentId}`,
            name: `${doc(li).text().trim()} - ${typeName}`.trim(),
            src: linkId,
            meta: { referer: match.contentId },
          });
        });
    });
    return servers;
  },
  async getVideo(server): Promise<ExtractedVideo> {
    const linkId = server.id.split("|")[0] ?? server.src;
    const referer = server.meta?.referer ?? BASE;
    const res = await fetchJson<{ result?: { url?: string } }>(
      `${BASE}ajax/episode/sources/${linkId}`,
      { referer, origin: BASE, mode: "xhr" }
    );
    const url = res.result?.url;
    if (!url) throw new Error("Anikoto: no stream URL");
    const full = url.startsWith("http") ? url : `${BASE}${url.replace(/^\//, "")}`;
    return extractVideo(full, server.name);
  },
};
