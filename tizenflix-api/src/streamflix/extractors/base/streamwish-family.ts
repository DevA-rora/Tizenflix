import type { ExtractedVideo } from "../../types.js";
import { fetchText } from "../../http.js";
import { unpackJs } from "../../network/js-unpacker.js";

export async function extractStreamWishPacked(
  link: string,
  referer?: string
): Promise<ExtractedVideo> {
  const html = await fetchText(link, { referer });
  const packed = html.match(/(eval\(function\(p,a,c,k,e,d\)[\s\S]*?)<\/script>/i)?.[1];
  const script = packed ? unpackJs(packed) ?? html : html;

  const patterns = [
    /file:\s*"([^"]+)"/,
    /sources:\s*\[\s*\{\s*file:\s*"([^"]+)"/,
    /hls2?:\s*"([^"]+)"/,
    /"(https?:\/\/[^"]+\.m3u8[^"]*)"/,
  ];

  for (const re of patterns) {
    const m = script.match(re);
    if (m?.[1]) {
      return {
        source: m[1],
        subtitles: [],
        headers: referer ? { Referer: referer } : undefined,
        type: m[1].includes(".m3u8") ? "m3u8" : undefined,
      };
    }
  }

  throw new Error("StreamWish: packed source not found");
}
