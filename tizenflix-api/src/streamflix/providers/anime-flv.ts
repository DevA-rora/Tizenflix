import * as cheerio from "cheerio";
import type { ContentProvider } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { fetchText } from "../http.js";
import { extractVideo } from "../extractors/registry.js";

const BASE = "https://www3.animeflv.net/";

export const animeFlvProvider: ContentProvider = {
  id: "anime-flv",
  name: "AnimeFLV",
  language: "es",
  supportsMovies: false,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(_tmdbId, _type, meta) {
    const html = await fetchText(`${BASE}browse?q=${encodeURIComponent(meta.title)}&page=1`, {
      referer: BASE,
    });
    const $ = cheerio.load(html);
    let id: string | null = null;
    let title = meta.title;
    $("ul.ListAnimes li article").each((_, el) => {
      const href = $(el).find("div.Description a.Button").attr("href") ?? "";
      const t = $(el).find("a h3").text().trim();
      if (t.toLowerCase().includes(meta.title.toLowerCase().slice(0, 6))) {
        id = href.split("/").pop() ?? null;
        title = t;
        return false;
      }
    });
    if (!id) return null;
    return { providerId: "anime-flv", contentId: id, title };
  },
  async getServers(match, type, _season = "1", episode = "1") {
    let pageUrl = `${BASE}anime/${match.contentId}`;
    if (type === "tv") {
      const detail = await fetchText(pageUrl, { referer: BASE });
      const $ = cheerio.load(detail);
      const script = $("script")
        .map((_, el) => $(el).html() ?? "")
        .get()
        .find((s) => s.includes("var episodes =")) ?? "";
      const animeInfo = script.match(/var\s+anime_info\s*=\s*(\[[^\]]+])/)?.[1];
      let animeUri = "";
      if (animeInfo) {
        try {
          animeUri = (JSON.parse(animeInfo) as string[])[2] ?? "";
        } catch {
          /* ignore */
        }
      }
      pageUrl = `${BASE}ver/${animeUri}-${episode}`;
    } else {
      const detail = await fetchText(pageUrl, { referer: BASE });
      const $ = cheerio.load(detail);
      const script = $("script")
        .map((_, el) => $(el).html() ?? "")
        .get()
        .find((s) => s.includes("var episodes =")) ?? "";
      const animeInfo = script.match(/var\s+anime_info\s*=\s*(\[[^\]]+])/)?.[1];
      let animeUri = "";
      if (animeInfo) {
        try {
          animeUri = (JSON.parse(animeInfo) as string[])[2] ?? "";
        } catch {
          /* ignore */
        }
      }
      pageUrl = `${BASE}ver/${animeUri}-1`;
    }

    const html = await fetchText(pageUrl, { referer: BASE });
    const script = html.match(/var videos =(\{[\s\S]*?\});/)?.[1];
    if (!script) return [];
    const data = JSON.parse(script) as { sub?: Array<{ code: string; title?: string }> };
    return (data.sub ?? [])
      .filter((s) => s.code)
      .map((s, i) => ({ id: s.code, name: s.title ?? `Server ${i + 1}`, src: s.code }));
  },
  async getVideo(server): Promise<ExtractedVideo> {
    return extractVideo(server.src, server.name);
  },
};
