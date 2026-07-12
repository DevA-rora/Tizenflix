import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { unpackJs } from "../network/js-unpacker.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function extractMixdrop(link: string): Promise<ExtractedVideo> {
  const embed = link
    .replace("/f/", "/e/")
    .replace(".club/", ".ag/")
    .replace(/^(https?:\/\/[^/]+\/e\/[^/?#]+).*/i, "$1");

  const html = await fetchText(embed, { headers: { "User-Agent": UA } });
  const packed = html.match(/(eval\(function\(p,a,c,k,e,d\)[\s\S]*?)<\/script>/i)?.[1];
  const script = packed ? unpackJs(packed) ?? html : html;
  const src = script.match(/wurl.*?=.*?"(.*?)";/)?.[1];
  if (!src) throw new Error("MixDrop: source not found");

  const finalUrl = src.startsWith("//") ? `https:${src}` : src.startsWith("http") ? src : `https://${src}`;
  return { source: finalUrl, subtitles: [], headers: { "User-Agent": UA } };
}

export const mixdropExtractor: ExtractorDef = {
  name: "MixDrop",
  mainUrl: "https://mixdrop.co",
  aliasUrls: [
    "https://mixdrop.bz",
    "https://mixdrop.ag",
    "https://mixdrop.ch",
    "https://mixdrop.to",
    "https://mixdrop.cv",
    "https://mxdrop.to",
    "https://mixdrop.club",
    "https://m1xdrop.net",
  ],
  extract: extractMixdrop,
};
