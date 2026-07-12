import type { ExtractedVideo } from "../types.js";
import { fetchJson, fetchText } from "../http.js";

const VIDPLAY_HOSTS = ["https://vidplay.site", "https://vidplay.online", "https://mcloud.bz"];

interface VidplayKeys {
  encrypt: string[];
  decrypt: string[];
}

interface VidplayResult {
  sources?: Array<{ file?: string }>;
  tracks?: Array<{ file?: string; label?: string; kind?: string }>;
}

interface VidplayResponse {
  status?: number;
  result: VidplayResult | string;
}

function decodeData(key: string, data: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + keyBytes[i % keyBytes.length]!) & 0xff;
    const tmp = s[i]!;
    s[i] = s[j]!;
    s[j] = tmp;
  }

  const decoded = new Uint8Array(data.length);
  let i = 0;
  let k = 0;
  for (let index = 0; index < decoded.length; index++) {
    i = (i + 1) & 0xff;
    k = (k + s[i]!) & 0xff;
    const tmp = s[i]!;
    s[i] = s[k]!;
    s[k] = tmp;
    const t = (s[i]! + s[k]!) & 0xff;
    decoded[index] = data.charCodeAt(index) ^ s[t]!;
  }
  return decoded;
}

function encodeVidplay(key: string, vId: string): string {
  const decodedId = decodeData(key, vId);
  const encodedBase64 = Buffer.from(decodedId).toString("base64");
  return encodedBase64.replace(/\//g, "_").replace(/\+/g, "-");
}

function decryptVidplayResult(key: string, encrypted: string): VidplayResult {
  const standardized = encrypted.replace(/_/g, "/").replace(/-/g, "+");
  const data = Buffer.from(standardized, "base64");
  const decoded = decodeData(key, Buffer.from(data).toString("binary"));
  const json = Buffer.from(decoded).toString("utf8");
  const decodedText = decodeURIComponent(json);
  return JSON.parse(decodedText) as VidplayResult;
}

function resolveHost(link: string): string {
  for (const host of VIDPLAY_HOSTS) {
    if (link.includes(new URL(host).hostname)) return host;
  }
  const match = link.match(/^(https?:\/\/[^/]+)/);
  return match?.[1] ?? VIDPLAY_HOSTS[0]!;
}

async function extractVidplay(link: string): Promise<ExtractedVideo> {
  const host = resolveHost(link);
  const id = link.split("?")[0]!.split("/").pop()!;
  const keys = await fetchJson<VidplayKeys>(
    "https://raw.githubusercontent.com/Ciarands/vidsrc-keys/main/keys.json"
  );

  const encId = encodeVidplay(keys.encrypt[1]!, id);
  const h = encodeVidplay(keys.encrypt[2]!, id);
  const query = link.includes("?") ? link.split("?")[1] : "";
  const mediaUrl = `${host}/mediainfo/${encId}?${query}&autostart=true&ads=0&h=${h}`;

  const response = await fetchJson<VidplayResponse>(mediaUrl, {
    headers: {
      Referer: link,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  let result: VidplayResult;
  if (typeof response.result === "string") {
    result = decryptVidplayResult(keys.decrypt[1]!, response.result);
  } else {
    result = response.result;
  }

  const source = result.sources?.[0]?.file;
  if (!source) throw new Error("Vidplay: no source found");

  const subtitles =
    result.tracks
      ?.filter((t) => t.kind === "captions" && t.file)
      .map((t) => ({
        label: t.label ?? "Unknown",
        file: t.file!,
      })) ?? [];

  return {
    source,
    subtitles,
    headers: { Referer: link },
  };
}

export const vidplayExtractor = {
  name: "Vidplay",
  mainUrl: "https://vidplay.site",
  aliasUrls: ["https://vidplay.online", "https://mcloud.bz"],
  extract: extractVidplay,
};

export const myCloudExtractor = {
  name: "MyCloud",
  mainUrl: "https://mcloud.bz",
  extract: extractVidplay,
};
