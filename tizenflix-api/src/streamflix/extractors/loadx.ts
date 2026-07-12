import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { networkFetch } from "../network/client.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0";

async function extractLoadx(link: string): Promise<ExtractedVideo> {
  const videoId = link.split("/").pop() ?? "";
  const page = await networkFetch(link, { headers: { "User-Agent": UA } });
  const cookieMatch = page.text.match(/fireplayer_player=([^;]+)/);
  const cookie = cookieMatch ? `fireplayer_player=${cookieMatch[1]}` : "";
  if (!cookie) throw new Error("LoadX: fireplayer_player cookie not found");

  const apiUrl = `https://loadx.ws/api/video`;
  const res = await networkFetch(apiUrl, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Referer: "https://loadx.ws/",
      Origin: "https://loadx.ws",
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(videoId)}`,
    mode: "xhr",
  });

  const json = JSON.parse(res.text) as { videoSource?: string };
  if (!json.videoSource) throw new Error("LoadX: videoSource missing");

  return {
    source: json.videoSource,
    subtitles: [],
    type: "m3u8",
    headers: {
      "User-Agent": UA,
      Referer: "https://loadx.ws/",
      Origin: "https://loadx.ws",
      Cookie: cookie,
    },
  };
}

export const loadxExtractor: ExtractorDef = {
  name: "LoadX",
  mainUrl: "https://loadx.ws/",
  extract: extractLoadx,
};
