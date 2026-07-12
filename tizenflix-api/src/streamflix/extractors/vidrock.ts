import type { ExtractorDef } from "../types.js";
import { fetchJson } from "../http.js";

const MAIN_URL = "https://vidrock.net";

async function extractVidrock(link: string) {
  const serverName = link.includes("#") ? link.split("#")[1] : "";
  const apiLink = link.split("#")[0];

  const response = await fetchJson<Record<string, { url?: string }>>(apiLink, {
    headers: { Referer: `${MAIN_URL}/`, Origin: MAIN_URL },
  });

  const entry = serverName
    ? Object.entries(response).find(([k]) => k.toLowerCase() === serverName.toLowerCase())
    : Object.entries(response).find(([, v]) => v?.url);

  const videoUrl = entry?.[1]?.url;
  if (!videoUrl) throw new Error("Vidrock: no stream URL");

  return {
    source: videoUrl,
    subtitles: [],
    headers: { Referer: `${MAIN_URL}/`, Origin: MAIN_URL },
    type: videoUrl.includes(".m3u8") ? ("m3u8" as const) : undefined,
  };
}

export const vidrockExtractor: ExtractorDef = {
  name: "Vidrock",
  mainUrl: MAIN_URL,
  extract: (link) => extractVidrock(link),
};
