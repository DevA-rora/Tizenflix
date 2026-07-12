import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { unpackJs } from "../network/js-unpacker.js";

function sigDecode(encoded: string): string {
  const rev = encoded.split("").reverse().join("");
  const step1 = Buffer.from(rev, "base64").toString("utf8");
  const step2 = step1.split("").reverse().join("");
  return Buffer.from(step2, "base64").toString("utf8");
}

async function extractVidGuard(link: string): Promise<ExtractedVideo> {
  const url = link.startsWith("http") ? link : `https:${link}`;
  const html = await fetchText(url);
  const packed = html.match(/eval\(function\(p,a,c,k,e,d\)([\s\S]*?)<\/script>/i);
  if (!packed) throw new Error("VidGuard: packed script not found");

  const script = unpackJs(`eval(function(p,a,c,k,e,d)${packed[1]}`);
  if (!script) throw new Error("VidGuard: unpack failed");

  const encoded = script.match(/window\.svg=\{"stream":"([^"]+)"/)?.[1];
  if (!encoded) throw new Error("VidGuard: stream token not found");

  return {
    source: sigDecode(encoded),
    subtitles: [],
    headers: { Referer: "https://vidguard.to" },
  };
}

export const vidGuardExtractor: ExtractorDef = {
  name: "VidGuard",
  mainUrl: "https://vidguard.to",
  aliasUrls: ["https://vembed.net", "https://bembed.cc", "https://vgfplay.com", "https://listeamed.net"],
  extract: extractVidGuard,
};
