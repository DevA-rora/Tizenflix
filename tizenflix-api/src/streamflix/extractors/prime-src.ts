import type { ExtractorDef } from "../types.js";
import { fetchJson } from "../http.js";

const MAIN_URL = "https://primesrc.me";

async function extractPrimeSrc(link: string) {
  const res = await fetchJson<{ link?: string }>(link);
  if (!res.link) throw new Error("PrimeSrc: no link");
  const { extractVideo } = await import("./registry.js");
  return extractVideo(res.link);
}

export const primeSrcExtractor: ExtractorDef = {
  name: "PrimeSrc",
  mainUrl: MAIN_URL,
  extract: (link) => extractPrimeSrc(link),
};
