import { createDecipheriv } from "node:crypto";
import type { ExtractorDef } from "../types.js";
import { BROWSER_UA, fetchJson } from "../http.js";

const MAIN_URL = "https://vidrock.net";
const API_BASE = `${MAIN_URL}/api`;
/** AES-256-GCM key from vidrock.net frontend bundle (2026) */
const VIDROCK_GCM_KEY_HEX = "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f";

interface VidrockServerEntry {
  url?: string | null;
  type?: string | null;
  language?: string;
  flag?: string;
}

interface AtlasQuality {
  resolution: number;
  url: string;
}

function base64UrlDecode(input: string): Buffer {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad === 1) throw new Error("Vidrock: invalid base64url");
  return Buffer.from(b64, "base64");
}

function decryptVidrockUrl(encrypted: string): string {
  const data = base64UrlDecode(encrypted);
  if (data.length < 28) throw new Error("Vidrock: ciphertext too short");
  const iv = data.subarray(0, 12);
  const ciphertextWithTag = data.subarray(12);
  const tag = ciphertextWithTag.subarray(-16);
  const ciphertext = ciphertextWithTag.subarray(0, -16);
  const key = Buffer.from(VIDROCK_GCM_KEY_HEX, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function pickAtlasStream(manifestUrl: string): Promise<string> {
  const qualities = await fetchJson<AtlasQuality[]>(manifestUrl, {
    referer: `${MAIN_URL}/`,
    origin: MAIN_URL,
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!Array.isArray(qualities) || !qualities.length) {
    throw new Error("Vidrock Atlas: empty quality list");
  }
  const highest = qualities.reduce((best, q) =>
    q?.url && (!best || q.resolution > best.resolution) ? q : best
  , qualities[0]!);
  if (!highest?.url) throw new Error("Vidrock Atlas: no quality URL");
  return highest.url;
}

async function extractVidrock(link: string) {
  const serverName = link.includes("#") ? link.split("#")[1] : "";
  const apiLink = link.split("#")[0];

  const response = await fetchJson<Record<string, VidrockServerEntry>>(apiLink, {
    referer: `${MAIN_URL}/`,
    origin: MAIN_URL,
    headers: { "User-Agent": BROWSER_UA },
  });

  const entry = serverName
    ? Object.entries(response).find(([k]) => k.toLowerCase() === serverName.toLowerCase())
    : Object.entries(response).find(([, v]) => v?.url);

  const entryMeta = entry?.[1];
  const actualName = entry?.[0] ?? "";
  const encUrl = entryMeta?.url;
  const sourceType = entryMeta?.type;
  if (!encUrl) throw new Error("Vidrock: no stream URL");

  let videoUrl = decryptVidrockUrl(encUrl);
  const audioLanguage = entryMeta?.language
    ? String(entryMeta.language).toLowerCase().split("-")[0]
    : undefined;

  if (actualName.toLowerCase() === "atlas" || sourceType === "mp4") {
    try {
      videoUrl = await pickAtlasStream(videoUrl);
      return {
        source: videoUrl,
        subtitles: [],
        headers: { Referer: `${MAIN_URL}/`, Origin: MAIN_URL, "User-Agent": BROWSER_UA },
        type: "mp4" as const,
        audioLanguage,
        audioVariant: audioLanguage ? "dubbed" : "unknown",
      };
    } catch {
      /* fall through to direct URL */
    }
  }

  return {
    source: videoUrl,
    subtitles: [],
    headers: { Referer: `${MAIN_URL}/`, Origin: MAIN_URL, "User-Agent": BROWSER_UA },
    type: videoUrl.includes(".m3u8") || sourceType === "hls" ? ("m3u8" as const) : undefined,
    audioLanguage,
    audioVariant: audioLanguage ? "dubbed" : "unknown",
  };
}

export const vidrockExtractor: ExtractorDef = {
  name: "Vidrock",
  mainUrl: MAIN_URL,
  extract: (link) => extractVidrock(link),
};

/** Exported for unit tests */
export const vidrockCrypto = { decryptVidrockUrl, base64UrlDecode, VIDROCK_GCM_KEY_HEX };
