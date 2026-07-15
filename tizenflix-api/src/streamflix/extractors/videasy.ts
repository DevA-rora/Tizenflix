import type { ExtractorDef } from "../types.js";
import { BROWSER_UA } from "../http.js";
import { decryptAndParse } from "../../crypto/decrypt.js";
import { preferHlsSources } from "../../api/sources.js";
import type { DecryptedSourceResponse } from "../../types.js";

const API_BASE = "https://api.wingsdatabase.com";
const PLAYER_ORIGIN = "https://player.videasy.to";
const PLAYER_REFERER = "https://player.videasy.to/";

const HEADERS: HeadersInit = {
  Accept: "*/*",
  Origin: PLAYER_ORIGIN,
  Referer: PLAYER_REFERER,
  "User-Agent": BROWSER_UA,
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

async function fetchSeed(tmdbId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/seed?mediaId=${encodeURIComponent(tmdbId)}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Videasy seed HTTP ${res.status}`);
  const data = (await res.json()) as { seed?: string };
  if (!data.seed) throw new Error("Videasy: missing seed");
  return data.seed;
}

async function extractVideasy(link: string) {
  const url = new URL(link);
  const tmdbId = url.searchParams.get("tmdbId") ?? "";
  if (!tmdbId) throw new Error("Videasy: missing tmdbId");

  const seed = await fetchSeed(tmdbId);
  url.searchParams.set("enc", "2");
  url.searchParams.set("seed", seed);
  url.searchParams.set("_t", String(Date.now()));

  const encRes = await fetch(url.toString(), { headers: HEADERS });
  if (!encRes.ok) throw new Error(`Videasy sources HTTP ${encRes.status}`);
  const ciphertext = await encRes.text();
  const parsed = preferHlsSources(
    decryptAndParse<DecryptedSourceResponse>(ciphertext, seed, parseInt(tmdbId, 10))
  );

  const source = parsed.sources?.[0]?.url;
  if (!source) throw new Error("Videasy: no source");

  const subtitles = (parsed.subtitles ?? [])
    .filter((t) => t.url || t.file)
    .map((t) => ({ label: String(t.language ?? t.label ?? "und"), file: String(t.url ?? t.file) }));

  const isMp4 =
    url.pathname.includes("downloader2") ||
    (source.includes(".mp4") && !source.includes(".m3u8"));

  return {
    source,
    subtitles,
    headers: { Referer: PLAYER_REFERER, Origin: PLAYER_ORIGIN, "User-Agent": BROWSER_UA },
    type: isMp4 ? ("mp4" as const) : ("m3u8" as const),
  };
}

export const videasyExtractor: ExtractorDef = {
  name: "Videasy",
  mainUrl: API_BASE,
  aliasUrls: ["https://api.videasy.net", "https://api.videasy.to", "https://player.videasy.to"],
  extract: (link) => extractVideasy(link),
};
