import type { ExtractedVideo } from "../../types.js";
import { fetchText } from "../../http.js";
import { unpackJs } from "../../network/js-unpacker.js";

/** Generic packed-JS embed extraction (StreamSB, NinjaStream, etc.) */
export async function extractGenericPacked(
  link: string,
  referer?: string
): Promise<ExtractedVideo> {
  const html = await fetchText(link, { referer });
  const packed = html.match(/(eval\(function\(p,a,c,k,e,d\)[\s\S]*?)<\/script>/i)?.[1];
  const script = packed ? unpackJs(packed) ?? html : html;

  const src =
    script.match(/file:\s*"([^"]+)"/)?.[1] ??
    script.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/)?.[1] ??
    script.match(/sources:\s*\[\s*\{\s*file:\s*"([^"]+)"/)?.[1];

  if (!src) throw new Error("Generic packed: source not found");
  return {
    source: src,
    subtitles: [],
    headers: referer ? { Referer: referer } : undefined,
    type: src.includes(".m3u8") ? "m3u8" : undefined,
  };
}
