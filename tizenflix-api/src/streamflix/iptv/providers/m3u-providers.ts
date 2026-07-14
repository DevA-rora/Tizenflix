import { fetchText } from "../../http.js";
import { fetchJsonPost } from "../../network/client.js";
import {
  encodeChannelId,
  decodeChannelId,
  parseM3u,
  type M3uChannel,
} from "../../shared/m3u.js";
import type { ExtractedVideo } from "../../types.js";
import type { IptvChannel, IptvProvider } from "../types.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";

const channelCache = new Map<string, { channels: IptvChannel[]; expires: number }>();
const CACHE_MS = 30 * 60 * 1000;

async function loadM3uChannels(cacheKey: string, playlistUrl: string): Promise<IptvChannel[]> {
  const now = Date.now();
  const hit = channelCache.get(cacheKey);
  if (hit && hit.expires > now) return hit.channels;

  const body = await fetchText(playlistUrl, {
    headers: { "User-Agent": UA },
    timeoutMs: 30000,
  });
  const parsed = parseM3u(body);
  const channels = parsed.map((ch: M3uChannel) => ({
    id: encodeChannelId(ch),
    name: ch.name,
    logo: ch.logo,
    group: ch.group,
  }));
  channelCache.set(cacheKey, { channels, expires: now + CACHE_MS });
  return channels;
}

function channelToVideo(ch: M3uChannel): ExtractedVideo {
  const headers: Record<string, string> = { "User-Agent": ch.userAgent ?? UA };
  if (ch.referrer) headers.Referer = ch.referrer;
  return {
    source: ch.url,
    subtitles: [],
    headers,
    type: ch.url.includes(".m3u8") ? "m3u8" : undefined,
  };
}

export interface M3uIptvConfig {
  id: string;
  name: string;
  language: string;
  logo?: string;
  playlistUrl: string;
}

export function createM3uIptvProvider(cfg: M3uIptvConfig): IptvProvider {
  return {
    id: cfg.id,
    name: cfg.name,
    language: cfg.language,
    logo: cfg.logo,
    enabled: true,
    getChannels: () => loadM3uChannels(cfg.id, cfg.playlistUrl),
    async getStream(channelId: string) {
      const ch = decodeChannelId(channelId);
      return channelToVideo(ch);
    },
  };
}

/** Pluto TV variants — BuddyChewChew M3U playlists */
const PLUTO_PLAYLISTS: Record<string, { lang: string; name: string }> = {
  "pluto-tv-us": { lang: "en", name: "Pluto TV US" },
  "pluto-tv-mx": { lang: "es", name: "Pluto TV MX" },
  "pluto-tv-ar": { lang: "es", name: "Pluto TV AR" },
  "pluto-tv-de": { lang: "de", name: "Pluto TV DE" },
  "pluto-tv-es": { lang: "es", name: "Pluto TV ES" },
  "pluto-tv-fr": { lang: "fr", name: "Pluto TV FR" },
  "pluto-tv-it": { lang: "it", name: "Pluto TV IT" },
};

export function createPlutoTvProvider(id: keyof typeof PLUTO_PLAYLISTS): IptvProvider {
  const meta = PLUTO_PLAYLISTS[id]!;
  const region = id.replace("pluto-tv-", "");
  return createM3uIptvProvider({
    id,
    name: meta.name,
    language: meta.lang,
    logo: "https://i.ibb.co/qz7jJF1/plutotv.png",
    playlistUrl: `https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_${region}.m3u`,
  });
}

/** Vavoo live TV by locale */
const VAVOO_GROUPS: Record<string, { lang: string; region: string; groups: string[]; label: string }> = {
  de: { lang: "de", region: "DE", groups: ["Germany", "GERMANY"], label: "Germany" },
  it: { lang: "it", region: "IT", groups: ["Italy"], label: "Italy" },
  fr: { lang: "fr", region: "FR", groups: ["France", "France Sport"], label: "France" },
  es: { lang: "es", region: "ES", groups: ["Spain"], label: "Spain" },
  pl: { lang: "pl", region: "PL", groups: ["Poland"], label: "Poland" },
};

interface VavooCatalogItem {
  name: string;
  url: string;
  ids?: { id?: string };
}

export function createVavooProvider(locale: keyof typeof VAVOO_GROUPS): IptvProvider {
  const cfg = VAVOO_GROUPS[locale]!;
  const id = `vavoo-${locale}`;
  const baseUrl = "https://vavoo.to";
  const channelMap = new Map<string, M3uChannel>();

  async function fetchGroup(group: string): Promise<VavooCatalogItem[]> {
    const out: VavooCatalogItem[] = [];
    let cursor: number | null = null;
    for (let page = 0; page < 20; page++) {
      const body: Record<string, unknown> = {
        language: cfg.lang,
        region: cfg.region,
        catalogId: "iptv",
        id: "",
        adult: false,
        search: "",
        sort: "name",
        filter: { group },
        cursor: cursor ?? null,
      };
      const json = await fetchJsonPost<{ items?: VavooCatalogItem[]; nextCursor?: number | null }>(
        `${baseUrl}/mediahubmx-catalog.json`,
        body,
        { referer: `${baseUrl}/`, origin: baseUrl, headers: { "User-Agent": UA } }
      );
      const items = json.items ?? [];
      out.push(...items.filter((i) => i.url && i.name));
      if (json.nextCursor == null || items.length === 0) break;
      cursor = json.nextCursor;
    }
    return out;
  }

  return {
    id,
    name: `Vavoo ${cfg.label} Live TV`,
    language: cfg.lang,
    logo: `${baseUrl}/assets/favicon-Djqjt9PL.ico`,
    enabled: true,
    async getChannels() {
      const cacheKey = `vavoo-${locale}`;
      const now = Date.now();
      const hit = channelCache.get(cacheKey);
      if (hit && hit.expires > now) return hit.channels;

      const all: IptvChannel[] = [];
      for (const group of cfg.groups) {
        const items = await fetchGroup(group);
        for (const item of items) {
          const ch: M3uChannel = { name: item.name, url: item.url };
          const channelId = item.ids?.id ?? encodeChannelId(ch);
          channelMap.set(channelId, ch);
          all.push({ id: channelId, name: item.name, group });
        }
      }
      const deduped = [...new Map(all.map((c) => [c.id, c])).values()];
      channelCache.set(cacheKey, { channels: deduped, expires: now + CACHE_MS });
      return deduped;
    },
    async getStream(channelId: string) {
      let ch = channelMap.get(channelId);
      if (!ch) {
        const decoded = decodeChannelId(channelId);
        if (decoded.url.startsWith("http")) ch = decoded;
      }
      if (!ch?.url) {
        const json = await fetchJsonPost<{ url?: string }>(
          `${baseUrl}/mediahubmx-resolve.json`,
          { id: channelId },
          { referer: `${baseUrl}/`, origin: baseUrl, headers: { "User-Agent": UA } }
        );
        if (!json.url) throw new Error(`Vavoo: cannot resolve channel ${channelId}`);
        ch = { name: "Live", url: json.url };
      }
      return channelToVideo(ch);
    },
  };
}

export const iptvOrgProvider = createM3uIptvProvider({
  id: "iptv-org",
  name: "IPTV-All World",
  language: "en",
  logo: "https://i.ibb.co/W1d0CxF/Logo-IPTV-All-World.jpg",
  playlistUrl: "https://iptv-org.github.io/iptv/index.m3u",
});

export const iptvSpainProvider = createM3uIptvProvider({
  id: "iptv-spain",
  name: "IPTV Spain",
  language: "es",
  playlistUrl: "https://iptv-org.github.io/iptv/countries/es.m3u",
});

export const cineCityProvider = createM3uIptvProvider({
  id: "cine-city",
  name: "MAGISTV",
  language: "es",
  playlistUrl:
    "https://raw.githubusercontent.com/MAGISTVNET/MAGISTVNET/main/MAGISTV.m3u",
});
