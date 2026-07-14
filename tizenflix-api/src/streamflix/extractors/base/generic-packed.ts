import type { ExtractedVideo } from "../../types.js";
import { fetchText } from "../../http.js";
import { unpackJs } from "../../network/js-unpacker.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_REDIRECT_HOPS = 5;

const REDIRECT_PATTERNS = [
  /window\.location(?:\.href)?\.replace\(\s*['"]([^'"]+)['"]\s*\)/is,
  /window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/is,
  /location\.replace\(\s*['"]([^'"]+)['"]\s*\)/is,
  /location\.href\s*=\s*['"]([^'"]+)['"]/is,
  /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'>]+)["']/is,
];

const SOURCE_PATTERNS = [
  /(?:file|src)\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/i,
  /sources?\s*[:=]\s*\[\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/i,
  /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/i,
  /file:\s*"([^"]+)"/,
  /sources:\s*\[\s*\{\s*file:\s*"([^"]+)"/,
];

function normalize(text: string): string {
  return text.replace(/\\\//g, "/").replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
}

function findRedirectUrl(text: string): string | null {
  const decoded = normalize(text);
  for (const re of REDIRECT_PATTERNS) {
    const m = decoded.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function findSource(text: string): string | null {
  const decoded = normalize(text);
  for (const re of SOURCE_PATTERNS) {
    const m = decoded.match(re);
    const src = m?.[1];
    if (src?.startsWith("http")) return src;
  }
  return null;
}

function unpackScripts(html: string): string[] {
  const out: string[] = [html];
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    const body = m[1] ?? "";
    if (body.includes("eval(function(p,a,c,k,e")) {
      const packed = body.match(/(eval\(function\(p,a,c,k,e,d\)[\s\S]*)/)?.[1];
      if (packed) {
        const u = unpackJs(packed);
        if (u) out.push(u);
      }
    }
  }
  return out;
}

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/** Generic packed-JS embed extraction with redirect hops (StreamSB, Mp4Upload, NinjaStream, etc.) */
export async function extractGenericPacked(
  link: string,
  referer?: string
): Promise<ExtractedVideo> {
  let currentUrl = link;
  let currentReferer = referer ?? link;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const html = await fetchText(currentUrl, {
      referer: currentReferer,
      headers: { "User-Agent": UA },
    });

    for (const chunk of unpackScripts(html)) {
      const source = findSource(chunk);
      if (source) {
        const playbackBase = new URL(currentUrl).origin;
        return {
          source,
          subtitles: [],
          headers: {
            Referer: `${playbackBase}/`,
            Origin: playbackBase,
            "User-Agent": UA,
          },
          type: source.includes(".m3u8") ? "m3u8" : source.includes(".mp4") ? "mp4" : undefined,
        };
      }
    }

    let redirect: string | null = null;
    for (const chunk of unpackScripts(html)) {
      redirect = findRedirectUrl(chunk);
      if (redirect) break;
    }
    if (!redirect) break;

    currentReferer = currentUrl;
    currentUrl = resolveUrl(currentUrl, redirect);
  }

  throw new Error(`Generic packed: source not found for ${link}`);
}
