import type { ExtractedVideo } from "../../types.js";
import { BROWSER_UA, fetchText } from "../../http.js";
import { unpackJs } from "../../network/js-unpacker.js";

function resolveRelativeUrl(base: string, source: string): string {
  if (source.startsWith("http")) return source;
  if (source.startsWith("//")) return `https:${source}`;
  try {
    return new URL(source, base).href;
  } catch {
    return source;
  }
}

function findBestM3u8(script: string, baseUrl: string): string | null {
  const re =
    /(?:["']?hls(\d*)["']?|["']?file["']?)\s*[:=]\s*["']((?:https?:\/\/|\/)[^"']+\.m3u8[^"']*)["']/gi;
  const matches: Array<{ quality: number; url: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(script)) !== null) {
    const quality = parseInt(m[1] || "0", 10) || 0;
    matches.push({ quality, url: resolveRelativeUrl(baseUrl, m[2]!) });
  }
  if (!matches.length) {
    const fallback = script.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/);
    return fallback?.[1] ? resolveRelativeUrl(baseUrl, fallback[1]) : null;
  }
  matches.sort((a, b) => b.quality - a.quality);
  return matches[0]!.url;
}

function unpackScript(html: string): string {
  const packed = html.match(/(eval\(function\(p,a,c,k,e,d\)[\s\S]*?)<\/script>/i)?.[1];
  if (!packed) return html;
  return unpackJs(packed) ?? html;
}

export async function extractStreamWishPacked(
  link: string,
  referer?: string,
  mainHost?: string
): Promise<ExtractedVideo> {
  const html = await fetchText(link, {
    referer,
    redirect: "follow",
    headers: {
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.5",
      "User-Agent": BROWSER_UA,
    },
  });

  const script = unpackScript(html);
  const finalBase = mainHost ? `${mainHost}/` : link;
  const m3u8 = findBestM3u8(script, finalBase);

  if (m3u8) {
    const origin = (() => {
      try {
        return new URL(m3u8).origin;
      } catch {
        return mainHost ?? referer ?? link;
      }
    })();
    return {
      source: m3u8,
      subtitles: [],
      headers: {
        Referer: referer ?? `${origin}/`,
        Origin: origin,
        "User-Agent": BROWSER_UA,
        Accept: "*/*",
      },
      type: "m3u8",
    };
  }

  const patterns = [
    /file:\s*"([^"]+)"/,
    /sources:\s*\[\s*\{\s*file:\s*"([^"]+)"/,
    /"(https?:\/\/[^"]+\.m3u8[^"]*)"/,
  ];

  for (const re of patterns) {
    const m = script.match(re);
    if (m?.[1]) {
      const source = resolveRelativeUrl(finalBase, m[1]);
      return {
        source,
        subtitles: [],
        headers: referer ? { Referer: referer, "User-Agent": BROWSER_UA } : { "User-Agent": BROWSER_UA },
        type: source.includes(".m3u8") ? "m3u8" : undefined,
      };
    }
  }

  throw new Error("StreamWish: packed source not found");
}
