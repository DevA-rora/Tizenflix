import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { doodLaExtractor } from "./dood-la.js";

const MAIN_URL = "https://einschalten.in";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Content-Type": "application/json",
};

export function buildEinschaltenEntry(opts: {
  type: "movie" | "tv";
  tmdbId: string;
}): { name: string; url: string } | null {
  if (opts.type !== "movie") return null;
  return {
    name: "Einschalten",
    url: `${MAIN_URL}/api/movies/${opts.tmdbId}/watch`,
  };
}

async function extractEinschalten(link: string): Promise<ExtractedVideo> {
  if (!link) throw new Error("Einschalten: invalid link");

  const body = await fetchText(link, { headers: HEADERS, referer: MAIN_URL });
  const json = JSON.parse(body) as { streamUrl?: string };
  const streamUrl = (json.streamUrl ?? "").trim();
  if (!streamUrl) throw new Error("Einschalten: no stream found");

  return doodLaExtractor.extract(streamUrl);
}

/** Ported from Streamflix EinschaltenExtractor */
export const einschaltenExtractor: ExtractorDef = {
  name: "Einschalten",
  mainUrl: MAIN_URL,
  extract: extractEinschalten,
};
