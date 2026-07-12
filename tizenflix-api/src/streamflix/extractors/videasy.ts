import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { BROWSER_UA } from "../http.js";

const DECRYPT_URL = "https://enc-dec.app/api/dec-videasy";

async function extractVideasy(link: string) {
  const encData = await fetchText(link, {
    headers: { "User-Agent": BROWSER_UA },
  });

  const tmdbId = link.split("tmdbId=")[1]?.split("&")[0] ?? "";
  const res = await fetch(DECRYPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: encData, id: tmdbId }),
  });
  if (!res.ok) throw new Error(`Videasy decrypt HTTP ${res.status}`);
  const body = (await res.json()) as { result?: string };
  if (!body.result) throw new Error("Videasy: decrypt failed");

  const parsed = JSON.parse(body.result) as {
    sources?: Array<{ url?: string }>;
    subtitles?: Array<{ lang?: string; url?: string }>;
  };

  const source = parsed.sources?.[0]?.url;
  if (!source) throw new Error("Videasy: no source");

  const subtitles = (parsed.subtitles ?? [])
    .filter((t) => t.url)
    .map((t) => ({ label: t.lang ?? "und", file: t.url! }));

  const isMp4 = link.includes("downloader2") || link.includes("cdn");
  return {
    source,
    subtitles,
    headers: { Referer: "https://player.videasy.net/" },
    type: isMp4 ? undefined : ("m3u8" as const),
  };
}

export const videasyExtractor: ExtractorDef = {
  name: "Videasy",
  mainUrl: "https://api.videasy.net",
  extract: (link) => extractVideasy(link),
};
