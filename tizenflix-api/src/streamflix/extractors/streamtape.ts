import type { ExtractedVideo } from "../types.js";
import { BROWSER_UA, fetchText } from "../http.js";

const MAIN_URL = "https://streamtape.com";
const ALIAS_URLS = ["https://streamta.site"];

export const streamtapeExtractor = {
  name: "Streamtape",
  mainUrl: MAIN_URL,
  aliasUrls: ALIAS_URLS,
  async extract(link: string): Promise<ExtractedVideo> {
    const baseUrl = link.includes("streamta.site") ? "https://streamta.site" : MAIN_URL;
    const path = link.replace(baseUrl, "");

    const html = await fetchText(baseUrl + path, {
      headers: { "User-Agent": BROWSER_UA },
    });

    const scriptRegex =
      /document\.getElementById\('botlink'\)\.innerHTML\s*=\s*'([^']+)'\s*\+\s*\('([^']+)'\)\.substring\((\d+)\)/;
    const scriptMatch = html.match(scriptRegex);
    if (!scriptMatch) throw new Error("Streamtape: botlink JavaScript not found");

    const paramString = scriptMatch[2];
    const substringIndex = parseInt(scriptMatch[3], 10);
    const cleanParams = paramString.substring(substringIndex);

    const videoId = cleanParams.match(/id=([^&]+)/)?.[1];
    const expires = cleanParams.match(/expires=([^&]+)/)?.[1];
    const ip = cleanParams.match(/ip=([^&]+)/)?.[1];
    const token = cleanParams.match(/token=([^&]+)/)?.[1];
    if (!videoId || !expires || !ip || !token) {
      throw new Error("Streamtape: missing video params");
    }

    const finalVideoUrl = `${baseUrl}/get_video?id=${videoId}&expires=${expires}&ip=${ip}&token=${token}&stream=1`;

    const res = await fetch(finalVideoUrl, {
      headers: { "User-Agent": BROWSER_UA },
      redirect: "manual",
    });

    const location = res.headers.get("location");
    if (location) {
      return { source: location, subtitles: [], headers: { Referer: baseUrl } };
    }

    // Follow redirects manually
    let current = finalVideoUrl;
    for (let i = 0; i < 5; i++) {
      const r = await fetch(current, {
        headers: { "User-Agent": BROWSER_UA },
        redirect: "manual",
      });
      const loc = r.headers.get("location");
      if (!loc) {
        if (r.ok && r.url && r.url !== current) {
          return { source: r.url, subtitles: [], headers: { Referer: baseUrl } };
        }
        break;
      }
      current = loc.startsWith("http") ? loc : new URL(loc, baseUrl).href;
    }

    throw new Error("Streamtape: could not resolve video URL");
  },
};
