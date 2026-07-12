import type { ExtractorDef } from "../types.js";
import { fetchJson, fetchText } from "../http.js";

const MAIN_URL = "https://vidsrc.to";
const KEYS_URL = "https://raw.githubusercontent.com/Ciarands/vidsrc-keys/main/keys.json";

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
    const t = (s[i]! + s[j]!) & 0xff;
    out[k] = data[k]! ^ s[t]!;
  }
  return out;
}

function decodeData(key: string, data: string): Buffer {
  const keyBytes = Buffer.from(key, "utf8");
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + keyBytes[i % keyBytes.length]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const decoded = Buffer.alloc(data.length);
  let i = 0;
  let k = 0;
  for (let idx = 0; idx < data.length; idx++) {
    i = (i + 1) & 0xff;
    k = (k + s[i]!) & 0xff;
    [s[i], s[k]] = [s[k]!, s[i]!];
    const t = (s[i]! + s[k]!) & 0xff;
    decoded[idx] = data.charCodeAt(idx) ^ s[t]!;
  }
  return decoded;
}

function encodeKey(key: string, vId: string): string {
  const decoded = decodeData(key, vId);
  return Buffer.from(decoded).toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
}

function decryptUrl(key: string, encUrl: string): string {
  const data = Buffer.from(encUrl, "base64url");
  const decrypted = rc4(Buffer.from(key, "utf8"), data);
  return decodeURIComponent(decrypted.toString("utf8"));
}

async function extractVidsrcTo(link: string) {
  const html = await fetchText(link);
  const mediaId = html.match(/data-id="([^"]+)"/)?.[1];
  if (!mediaId) throw new Error("Vidsrc.to: media id not found");

  const keys = await fetchJson<{ encrypt: string[]; decrypt: string[] }>(KEYS_URL);
  const token = encodeKey(keys.encrypt[0]!, mediaId);
  const sourcesRes = await fetchJson<{ result?: Array<{ id: string; title: string }> }>(
    `${MAIN_URL}/ajax/embed/episode/${mediaId}/sources?token=${token}`,
    { referer: link }
  );

  const sources = sourcesRes.result ?? [];
  if (!sources.length) throw new Error("Vidsrc.to: no sources");

  let lastErr: Error | null = null;
  for (const source of sources) {
    try {
      const token2 = encodeKey(keys.encrypt[0]!, source.id);
      const embedRes = await fetchJson<{ result: { url: string } }>(
        `${MAIN_URL}/ajax/embed/source/${source.id}?token=${token2}`,
        { referer: link }
      );
      const finalUrl = decryptUrl(keys.decrypt[0]!, embedRes.result.url);
      if (finalUrl === embedRes.result.url) continue;
      const { extractVideo } = await import("./registry.js");
      return extractVideo(finalUrl, source.title);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new Error("Vidsrc.to: all sources failed");
}

export const vidsrcToExtractor: ExtractorDef = {
  name: "Vidsrc.to",
  mainUrl: MAIN_URL,
  extract: (link) => extractVidsrcTo(link),
};
