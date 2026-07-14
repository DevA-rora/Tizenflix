import {
  INLINE_MANIFEST_PREFIX,
  storeInlineManifest,
} from "../../cache/inline-manifest-cache.js";
import { getExtractLang, getExtractMaxHeight } from "../extract-context.js";
import type { ExtractorDef } from "../types.js";
import { fetchJson, fetchText } from "../http.js";
import { BROWSER_UA } from "../http.js";
import { parseMaxManifestHeight } from "../../proxy/rewrite-m3u8.js";
import { patchVixSrcPlaylist } from "./vix-src-playlist.js";

const MAIN_URL = "https://vixsrc.to";

function wantsFhdPlaylist(canFhd: boolean, targetMaxHeight?: number): boolean {
  if (canFhd) return true;
  return typeof targetMaxHeight === "number" && targetMaxHeight >= 1080;
}

function buildPlaylistParams(
  token: string,
  expires: string,
  hasB: boolean,
  requestFhd: boolean,
  lang: string
): URLSearchParams {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (expires) params.set("expires", expires);
  if (hasB) params.set("b", "1");
  if (requestFhd) params.set("h", "1");
  params.set("lang", lang);
  return params;
}

async function fetchVixSrcPlaylist(
  playlistUrl: string,
  referer: string,
  headers: Record<string, string>
): Promise<{ body: string; maxHeight: number } | null> {
  try {
    const playlistBody = await fetchText(playlistUrl, {
      headers: {
        ...headers,
        Referer: referer,
        Accept: "*/*",
      },
      referer,
    });
    if (!playlistBody.trimStart().startsWith("#EXTM3U")) return null;
    return { body: playlistBody, maxHeight: parseMaxManifestHeight(playlistBody) };
  } catch {
    return null;
  }
}

async function extractVixSrc(link: string, lang = "en", targetMaxHeight?: number) {
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
  const requestFhd = wantsFhdPlaylist(canFhd, targetMaxHeight);

  const referer = `${MAIN_URL}/${embedPath}`;
  let params = buildPlaylistParams(token, expires, hasB, requestFhd, lang);
  let playlistUrl = `${MAIN_URL}/playlist/${videoId}.m3u8?${params.toString()}`;

  let fetched = await fetchVixSrcPlaylist(playlistUrl, referer, headers);
  if (
    fetched &&
    targetMaxHeight &&
    targetMaxHeight > 0 &&
    fetched.maxHeight > 0 &&
    fetched.maxHeight < targetMaxHeight &&
    !requestFhd
  ) {
    params = buildPlaylistParams(token, expires, hasB, true, lang);
    playlistUrl = `${MAIN_URL}/playlist/${videoId}.m3u8?${params.toString()}`;
    const retry = await fetchVixSrcPlaylist(playlistUrl, referer, headers);
    if (retry && retry.maxHeight >= fetched.maxHeight) {
      fetched = retry;
    }
  }

  let source = playlistUrl;
  let manifestMaxHeight = fetched?.maxHeight ?? 0;
  if (fetched) {
    const patched = patchVixSrcPlaylist(fetched.body, playlistUrl, lang);
    manifestMaxHeight = parseMaxManifestHeight(patched) || manifestMaxHeight;
    const manifestToken = storeInlineManifest(patched, playlistUrl, referer);
    source = `${INLINE_MANIFEST_PREFIX}${manifestToken}`;
  }

  return {
    source,
    subtitles: [],
    headers: {
      Referer: referer,
      "User-Agent": BROWSER_UA,
    },
    type: "m3u8" as const,
    manifestMaxHeight: manifestMaxHeight > 0 ? manifestMaxHeight : undefined,
  };
}

export const vixSrcExtractor: ExtractorDef = {
  name: "VixSrc",
  mainUrl: MAIN_URL,
  aliasUrls: ["https://vixsrc.to/"],
  extract: (link) => extractVixSrc(link, getExtractLang(), getExtractMaxHeight()),
};
