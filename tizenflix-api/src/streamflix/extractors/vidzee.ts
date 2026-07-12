import { createDecipheriv, createHash } from "node:crypto";
import type { ExtractorDef } from "../types.js";
import { BROWSER_UA, fetchText } from "../http.js";

const MAIN_URL = "https://player.vidzee.wtf";
const CORE_API = "https://core.vidzee.wtf";
const STATIC_PASS = "c4a8f1d7e2b9a6c3d0f5e8a1b7c4d9e2";

const VIDZEE_HEADERS = {
  "User-Agent": BROWSER_UA,
  Origin: MAIN_URL,
  Referer: `${MAIN_URL}/`,
};

function decryptGcmMasterKey(b64: string): string {
  const data = Buffer.from(b64.trim(), "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const key = createHash("sha256").update(STATIC_PASS).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function getMasterKey(): Promise<string> {
  const b64 = await fetchText(`${CORE_API}/api-key`, { headers: VIDZEE_HEADERS });
  if (!b64?.trim()) throw new Error("Vidzee: empty api-key response");
  try {
    return decryptGcmMasterKey(b64);
  } catch (err) {
    throw new Error(
      `Vidzee: master key decrypt failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function decryptLink(encLink: string, masterKey: string): string {
  const decoded = Buffer.from(encLink, "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon < 0) throw new Error("Vidzee: invalid encrypted link format");
  const ivB64 = decoded.slice(0, colon);
  const ctB64 = decoded.slice(colon + 1);
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const keyBytes = Buffer.from(masterKey, "utf8");
  const padded = Buffer.alloc(32);
  keyBytes.copy(padded);
  const decipher = createDecipheriv("aes-256-cbc", padded, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function extractVidzee(link: string) {
  const masterKey = await getMasterKey();

  const body = await fetchText(link, { headers: VIDZEE_HEADERS });
  const json = JSON.parse(body) as {
    url?: Array<{ link?: string }>;
    tracks?: Array<{ lang?: string; url?: string }>;
  };

  const enc = json.url?.[0]?.link;
  if (!enc) throw new Error("Vidzee: empty encrypted link");
  const decrypted = decryptLink(enc, masterKey);

  return {
    source: decrypted,
    subtitles: (json.tracks ?? [])
      .filter((t) => t.url)
      .map((t) => ({ label: t.lang ?? "und", file: t.url! })),
    headers: VIDZEE_HEADERS,
    type: link.includes("sr=1") ? undefined : ("m3u8" as const),
  };
}

export const vidzeeExtractor: ExtractorDef = {
  name: "Vidzee",
  mainUrl: MAIN_URL,
  extract: (link) => extractVidzee(link),
};

/** Exported for unit tests */
export const vidzeeCrypto = { decryptGcmMasterKey, decryptLink, STATIC_PASS };
