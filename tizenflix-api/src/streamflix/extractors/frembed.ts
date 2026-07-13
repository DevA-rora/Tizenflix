import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { fetchJson, fetchText } from "../http.js";

const DEFAULT_URL = "https://frembed.click";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

interface ListLinks {
  link1?: string;
  link2?: string;
  link3?: string;
  link4?: string;
  link5?: string;
  link6?: string;
  link7?: string;
  link1vostfr?: string;
  link2vostfr?: string;
  link3vostfr?: string;
  link4vostfr?: string;
  link5vostfr?: string;
  link6vostfr?: string;
  link7vostfr?: string;
  link1vo?: string;
  link2vo?: string;
  link3vo?: string;
  link4vo?: string;
  link5vo?: string;
  link6vo?: string;
  link7vo?: string;
}

function getExtractorName(url: string): string {
  return url
    .substring(url.indexOf("://") + 3)
    .split("/")[0]!
    .split(".")[0]!
    .replace("crystaltreatmenteast", "voe")
    .replace("lauradaydo", "voe")
    .replace("lancewhosedifficult", "voe")
    .replace("dianaavoidthey", "voe")
    .replace("jefferycontrolmodel", "voe")
    .replace("richardquestionbuilding", "voe")
    .replace("juliewomanwish", "voe")
    .replace("myvidplay", "dood")
    .replace("playmogo", "dood")
    .replace(/^./, (c) => c.toUpperCase());
}

function listLinksToServers(links: ListLinks, mainUrl: string): Array<{ name: string; src: string }> {
  const keys = [
    "link1", "link2", "link3", "link4", "link5", "link6", "link7",
    "link1vostfr", "link2vostfr", "link3vostfr", "link4vostfr", "link5vostfr", "link6vostfr", "link7vostfr",
    "link1vo", "link2vo", "link3vo", "link4vo", "link5vo", "link6vo", "link7vo",
  ] as const;

  const servers: Array<{ name: string; src: string }> = [];
  for (let i = 0; i < keys.length; i++) {
    const data = links[keys[i]!];
    if (!data) continue;
    const lang = i < 7 ? "French" : i < 14 ? "VOSTFR" : "VO";
    const src = data.startsWith("/") ? mainUrl.replace(/\/$/, "") + data : data;
    servers.push({ name: `${getExtractorName(src)} (${lang})`, src });
  }
  return servers;
}

async function resolveRedirect(src: string, mainUrl: string): Promise<string> {
  try {
    const res = await fetch(src, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Referer: `${mainUrl}/`,
      },
    });
    const location = res.headers.get("location");
    if (!location) return src;
    return location.startsWith("//") ? `https:${location}` : location;
  } catch {
    return src;
  }
}

export async function buildFrembedEntries(
  opts: {
    type: "movie" | "tv";
    tmdbId: string;
    season?: string;
    episode?: string;
  },
  baseUrl = DEFAULT_URL
): Promise<Array<{ name: string; url: string }>> {
  const mainUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  let links: ListLinks;
  if (opts.type === "movie") {
    links = await fetchJson<ListLinks>(
      `${mainUrl}api/films?id=${opts.tmdbId}&idType=tmdb`,
      {
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/json" },
        referer: mainUrl,
      }
    );
  } else {
    links = await fetchJson<ListLinks>(
      `${mainUrl}api/series?id=${opts.tmdbId}&sa=${opts.season ?? "1"}&epi=${opts.episode ?? "1"}&idType=tmdb`,
      {
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/json" },
        referer: mainUrl,
      }
    );
  }

  const initial = listLinksToServers(links, mainUrl);
  const resolved = await Promise.all(
    initial.map(async (server) => {
      const redirect = await resolveRedirect(server.src, mainUrl);
      const lang = server.name.substring(server.name.indexOf("(") + 1, server.name.indexOf(")"));
      return {
        name: `${getExtractorName(redirect)} (${lang})`,
        url: redirect,
      };
    })
  );

  return resolved.filter((s) => s.url.startsWith("http"));
}

async function extractFrembed(_link: string): Promise<ExtractedVideo> {
  throw new Error("Frembed: use buildFrembedEntries for server discovery");
}

/** Ported from Streamflix FrembedExtractor */
export const frembedExtractor: ExtractorDef = {
  name: "Frembed",
  mainUrl: DEFAULT_URL,
  aliasUrls: ["https://frembed.click"],
  extract: extractFrembed,
};
