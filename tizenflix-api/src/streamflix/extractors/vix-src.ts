import {
  INLINE_MANIFEST_PREFIX,
  storeInlineManifest,
} from "../../cache/inline-manifest-cache.js";
import type { ExtractorDef } from "../types.js";
import { fetchJson, fetchText } from "../http.js";
import { BROWSER_UA } from "../http.js";
import { patchVixSrcPlaylist } from "./vix-src-playlist.js";

const MAIN_URL = "https://vixsrc.to";

async function extractVixSrc(link: string, lang = "en") {
  let apiPath = link.replace(MAIN_URL, "").replace(/^\//, "");
  if (!apiPath.startsWith("api/")) apiPath = `api/${apiPath}`;
  if (!apiPath.includes("lang=")) {
    apiPath += `${apiPath.includes("?") ? "&" : "?"}lang=${lang}`;
  }

  const apiUrl = `${MAIN_URL}/${apiPath}`;
  const headers = {
    "User-Agent": BROWSER_UA,
    Accept: "application/json, text/plain, */*",
    Referer: `${MAIN_URL}/`,
    "X-Requested-With": "XMLHttpRequest",
  };

  let apiRes = await fetchJson<{ src: string }>(apiUrl, { headers });
  let embedPath = apiRes.src.replace(/^\//, "");

  let html: string;
  try {
    html = await fetchText(`${MAIN_URL}/${embedPath}`, {
      headers: {
        ...headers,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      referer: `${MAIN_URL}/`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("410")) {
      apiRes = await fetchJson<{ src: string }>(apiUrl, { headers });
      embedPath = apiRes.src.replace(/^\//, "");
      html = await fetchText(`${MAIN_URL}/${embedPath}`, { headers, referer: `${MAIN_URL}/` });
    } else {
      throw err;
    }
  }

  const script = html;
  const videoId =
    script.match(/id:\s*['"](\d+)['"]/)?.[1] ??
    script.match(/id:\s*(\d+)/)?.[1];
  if (!videoId) throw new Error("VixSrc: video id not found");

  const masterBlock = script.includes("masterPlaylist")
    ? script.substring(script.indexOf("masterPlaylist"))
    : script;

  const token = masterBlock.match(/['"]token['"]\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? "";
  const expires = masterBlock.match(/['"]expires['"]\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? "";
  const hasB = masterBlock.includes("b=1") || masterBlock.includes("ub=1");
  const canFhd = script.includes("window.canPlayFHD = true");

  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (expires) params.set("expires", expires);
  if (hasB) params.set("b", "1");
  if (canFhd) params.set("h", "1");
  params.set("lang", lang);

  const playlistUrl = `${MAIN_URL}/playlist/${videoId}.m3u8?${params.toString()}`;
  const referer = `${MAIN_URL}/${embedPath}`;

  let source = playlistUrl;
  try {
    const playlistBody = await fetchText(playlistUrl, {
      headers: {
        ...headers,
        Referer: referer,
        Accept: "*/*",
      },
      referer,
    });
    if (playlistBody.trimStart().startsWith("#EXTM3U")) {
      const patched = patchVixSrcPlaylist(playlistBody, playlistUrl, lang);
      const manifestToken = storeInlineManifest(patched, playlistUrl, referer);
      source = `${INLINE_MANIFEST_PREFIX}${manifestToken}`;
    }
  } catch {
    /* fall back to remote playlist URL */
  }

  return {
    source,
    subtitles: [],
    headers: {
      Referer: referer,
      "User-Agent": BROWSER_UA,
    },
    type: "m3u8" as const,
  };
}

export const vixSrcExtractor: ExtractorDef = {
  name: "VixSrc",
  mainUrl: MAIN_URL,
  aliasUrls: ["https://vixsrc.to/"],
  extract: (link) => extractVixSrc(link),
};
