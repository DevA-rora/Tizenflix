import * as cheerio from "cheerio";
import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";

async function extractVixcloud(link: string, referer?: string): Promise<ExtractedVideo> {
  const url = new URL(link);
  const base = `${url.protocol}//${url.host}/`;
  const html = await fetchText(link, { referer: referer ?? base, origin: base });

  const scriptMatch = html.match(/window\.video\s*=\s*(\{[\s\S]*?\});/);
  if (!scriptMatch) throw new Error("Vixcloud: window.video not found");

  const sanitized = scriptMatch[1]!
    .replace(/'/g, '"')
    .replace(/\b(id|filename|token|expires|asn)\s*:/g, '"$1":');

  const video = JSON.parse(sanitized) as { id: number; filename: string };
  const paramsMatch = html.match(/window\.params\s*=\s*(\{[\s\S]*?\});/);
  const params = paramsMatch
    ? (JSON.parse(
        paramsMatch[1]!.replace(/'/g, '"').replace(/\b(token|expires)\s*:/g, '"$1":')
      ) as { token?: string; expires?: string })
    : {};

  const playlistUrl = `${base}playlist/${video.id}.m3u8?b=1&token=${params.token ?? ""}&expires=${params.expires ?? ""}&h=1&lang=en`;

  return {
    source: playlistUrl,
    subtitles: [],
    headers: {
      Referer: referer ?? base,
      Origin: base,
    },
    type: "m3u8",
  };
}

export const vixcloudExtractor: ExtractorDef = {
  name: "vixcloud",
  mainUrl: "https://vixcloud.co/",
  aliasUrls: ["https://vixsrc.to/", "https://vixcloud.co"],
  extract: extractVixcloud,
};
