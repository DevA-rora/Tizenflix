import type { ExtractorDef } from "../types.js";
import { interceptEmbedRequest } from "./base/playwright-embed.js";

const MAIN_URL = "https://vidlink.pro";

async function extractVidLink(link: string) {
  const hit = await interceptEmbedRequest(link, [
    { pattern: /\/api\/b\//, type: "json" },
  ]);

  const json = hit.json as { stream?: { playlist?: string; captions?: Array<{ id: string; language: string }> } };
  const playlist = json?.stream?.playlist;
  if (!playlist) throw new Error("VidLink: no playlist in API response");

  return {
    source: playlist,
    subtitles: (json.stream?.captions ?? []).map((c) => ({
      label: c.language,
      file: c.id,
    })),
    headers: { Referer: MAIN_URL },
    type: playlist.includes(".m3u8") ? ("m3u8" as const) : undefined,
  };
}

export const vidLinkExtractor: ExtractorDef = {
  name: "VidLink",
  mainUrl: MAIN_URL,
  extract: (link) => extractVidLink(link),
};
