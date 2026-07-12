import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { extractGenericPacked } from "./base/generic-packed.js";

const MAIN_URL = "https://vidflix.club";

async function extractVidflix(link: string) {
  const referer = link.replace("/api/", "/");
  const res = await fetch(link, {
    headers: { Referer: referer, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Vidflix API HTTP ${res.status}`);
  const data = (await res.json()) as {
    video_url?: string;
    subtitles?: Array<{ label: string; url: string }>;
  };
  if (!data.video_url) throw new Error("Vidflix: no video_url");

  const packed = await extractGenericPacked(data.video_url, referer);
  return {
    ...packed,
    subtitles: (data.subtitles ?? []).map((s) => ({ label: s.label, file: s.url })),
  };
}

export const vidflixExtractor: ExtractorDef = {
  name: "Vidflix",
  mainUrl: MAIN_URL,
  extract: (link) => extractVidflix(link),
};
