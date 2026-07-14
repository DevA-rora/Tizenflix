import * as cheerio from "cheerio";
import { fetchText } from "../../http.js";
import { encodeChannelId, decodeChannelId, type M3uChannel } from "../../shared/m3u.js";
import type { ExtractedVideo } from "../../types.js";
import type { IptvChannel, IptvProvider } from "../types.js";
import { extractVideo } from "../../extractors/registry.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";

const channelCache = new Map<string, { channels: IptvChannel[]; expires: number }>();
const CACHE_MS = 30 * 60 * 1000;

export interface ScrapeIptvConfig {
  id: string;
  name: string;
  language: string;
  logo?: string;
  baseUrl: string;
  /** Page path listing channels */
  listPath?: string;
}

async function scrapeChannelLinks(baseUrl: string, listPath = "/"): Promise<IptvChannel[]> {
  const url = listPath.startsWith("http") ? listPath : `${baseUrl}${listPath}`;
  const html = await fetchText(url, { referer: baseUrl, headers: { "User-Agent": UA } });
  const $ = cheerio.load(html);
  const channels: IptvChannel[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const title = $(el).text().trim() || $(el).find("img").attr("alt") || "";
    const logo = $(el).find("img").attr("src");
    if (!title || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (title.toLowerCase().includes("donar") || title.toLowerCase().includes("paypal")) return;
    const full = href.startsWith("http") ? href : new URL(href, baseUrl).href;
    const ch: M3uChannel = {
      name: title,
      url: full,
      logo: logo?.startsWith("http") ? logo : logo ? new URL(logo, baseUrl).href : undefined,
    };
    channels.push({ id: encodeChannelId(ch), name: title, logo: ch.logo });
  });

  return [...new Map(channels.map((c) => [c.name, c])).values()];
}

export function createScrapeIptvProvider(cfg: ScrapeIptvConfig): IptvProvider {
  return {
    id: cfg.id,
    name: cfg.name,
    language: cfg.language,
    logo: cfg.logo,
    enabled: true,
    async getChannels() {
      const now = Date.now();
      const hit = channelCache.get(cfg.id);
      if (hit && hit.expires > now) return hit.channels;
      const channels = await scrapeChannelLinks(cfg.baseUrl, cfg.listPath);
      channelCache.set(cfg.id, { channels, expires: now + CACHE_MS });
      return channels;
    },
    async getStream(channelId: string) {
      const ch = decodeChannelId(channelId);
      if (ch.url.includes("/embed") || ch.url.includes("player")) {
        return extractVideo(ch.url, cfg.name);
      }
      const headers: Record<string, string> = { "User-Agent": ch.userAgent ?? UA };
      if (ch.referrer) headers.Referer = ch.referrer;
      return {
        source: ch.url,
        subtitles: [],
        headers,
        type: ch.url.includes(".m3u8") ? "m3u8" : undefined,
      };
    },
  };
}

export const cableVisionHdProvider = createScrapeIptvProvider({
  id: "cable-vision-hd",
  name: "CableVisionHD",
  language: "es",
  logo: "https://i.ibb.co/4gMQkN2b/imagen-2025-09-05-212536248.png",
  baseUrl: "https://www.cablevisionhd.com",
});

export const tvLibrefutbolProvider = createScrapeIptvProvider({
  id: "tv-librefutbol",
  name: "Tv Libre Futbol",
  language: "es",
  baseUrl: "https://tvlibrefutbol.com",
});

export const tvporinternetHdProvider = createScrapeIptvProvider({
  id: "tvporinternet-hd",
  name: "TvporinternetHD",
  language: "es",
  baseUrl: "https://tvporinternethd.com",
});

export const pelotaLibreTvHdProvider = createScrapeIptvProvider({
  id: "pelota-libre-tv-hd",
  name: "Pelota Libre TV",
  language: "es",
  baseUrl: "https://pelotalibretvhd.com",
});
