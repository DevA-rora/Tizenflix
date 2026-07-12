import type { ExtractorDef } from "../types.js";
import { interceptEmbedRequest } from "./base/playwright-embed.js";

const MAIN_URL = "https://vidsrc.ru";

async function extractVidsrcRu(link: string) {
  const hit = await interceptEmbedRequest(link, [
    { pattern: /\/file2\/.*\.m3u8/, type: "m3u8" },
  ]);

  return {
    source: hit.url,
    subtitles: [],
    headers: { Referer: MAIN_URL },
    type: "m3u8" as const,
  };
}

export const vidsrcRuExtractor: ExtractorDef = {
  name: "Vidsrc.Ru",
  mainUrl: MAIN_URL,
  extract: (link) => extractVidsrcRu(link),
};
