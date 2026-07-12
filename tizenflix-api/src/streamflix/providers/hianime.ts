import * as cheerio from "cheerio";
import type { ContentProvider } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { fetchText } from "../network/client.js";
import { extractVideo } from "../extractors/registry.js";

const BASE = "https://hianime.cv/";

export const hiAnimeProvider: ContentProvider = {
  id: "hianime",
  name: "HiAnime",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "partial",
  async findByTmdb(_tmdbId, _type, meta) {
    const html = await fetchText(`${BASE}search?keyword=${encodeURIComponent(meta.title)}`, {
      referer: BASE,
    });
    const $ = cheerio.load(html);
    let href: string | null = null;
    $(".film-list .film-item, .flw-item").each((_, el) => {
      const title = $(el).find(".film-name, .dynamic-name").text().trim();
      const link = $(el).find("a").attr("href") ?? "";
      if (title.toLowerCase().includes(meta.title.toLowerCase().slice(0, 6))) {
        href = link.startsWith("http") ? link : `${BASE}${link.replace(/^\//, "")}`;
        return false;
      }
    });
    if (!href) return null;
    return { providerId: "hianime", contentId: href, title: meta.title };
  },
  async getServers(match, type, season = "1", episode = "1") {
    const detail = await fetchText(match.contentId, { referer: BASE });
    const $ = cheerio.load(detail);
    const servers: StreamServer[] = [];

    if (type === "tv") {
      const epId = $(`div.ep-item[data-number="${episode}"], li[data-number="${episode}"]`).attr("data-id");
      if (epId) {
        const epHtml = await fetchText(`${BASE}ajax/v2/episode/servers?episodeId=${epId}`, {
          referer: match.contentId,
          mode: "xhr",
        });
        const ep$ = cheerio.load(epHtml);
        ep$(".server-item, .btn-server").each((i, el) => {
          const id = ep$(el).attr("data-id") ?? String(i);
          servers.push({ id, name: ep$(el).text().trim() || `Server ${i + 1}`, src: id, meta: { referer: match.contentId } });
        });
      }
    } else {
      $(".server-item, .btn-server").each((i, el) => {
        const id = $(el).attr("data-id") ?? String(i);
        servers.push({ id, name: $(el).text().trim() || `Server ${i + 1}`, src: id, meta: { referer: match.contentId } });
      });
    }
    return servers;
  },
  async getVideo(server): Promise<ExtractedVideo> {
    const referer = server.meta?.referer ?? BASE;
    const res = await fetchText(`${BASE}ajax/v2/episode/sources?id=${server.src}`, {
      referer,
      mode: "xhr",
    });
    const data = JSON.parse(res) as { link?: string };
    if (!data.link) throw new Error("HiAnime: no link");
    return extractVideo(data.link, server.name);
  },
};
