import { createDecipheriv, createHash } from "node:crypto";
import type { ExtractorDef } from "../types.js";
import { BROWSER_UA } from "../http.js";

const MAIN_URL = "https://player.vidzee.wtf";
const CORE_API = "https://core.vidzee.wtf";
const STATIC_PASS = "4f2a9c7d1e8b3a6f0d5c2e9a7b1f4d8c";

async function getMasterKey(): Promise<string | null> {
  try {
    const res = await fetch(`${CORE_API}/api-key`, {
      headers: {
        "User-Agent": BROWSER_UA,
        Origin: MAIN_URL,
        Referer: `${MAIN_URL}/`,
      },
    });
    if (!res.ok) return null;
    const b64 = await res.text();
    const data = Buffer.from(b64, "base64");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const key = createHash("sha256").update(STATIC_PASS).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function decryptLink(encLink: string, masterKey: string): string | null {
  try {
    const decoded = Buffer.from(encLink, "base64").toString("utf8");
    const [ivB64, ctB64] = decoded.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const ciphertext = Buffer.from(ctB64, "base64");
    const keyBytes = Buffer.from(masterKey, "utf8");
    const padded = Buffer.alloc(32);
    keyBytes.copy(padded);
    const decipher = createDecipheriv("aes-256-cbc", padded, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function extractVidzee(link: string) {
  const masterKey = await getMasterKey();
  if (!masterKey) throw new Error("Vidzee: master key failed");

  const res = await fetch(link, {
    headers: {
      "User-Agent": BROWSER_UA,
      Origin: MAIN_URL,
      Referer: `${MAIN_URL}/`,
    },
  });
  if (!res.ok) throw new Error(`Vidzee HTTP ${res.status}`);
  const json = (await res.json()) as {
    url?: Array<{ link?: string }>;
    tracks?: Array<{ lang?: string; url?: string }>;
  };

  const enc = json.url?.[0]?.link;
  if (!enc) throw new Error("Vidzee: empty encrypted link");
  const decrypted = decryptLink(enc, masterKey);
  if (!decrypted) throw new Error("Vidzee: decrypt failed");

  return {
    source: decrypted,
    subtitles: (json.tracks ?? [])
      .filter((t) => t.url)
      .map((t) => ({ label: t.lang ?? "und", file: t.url! })),
    headers: { Referer: MAIN_URL, Origin: MAIN_URL, "User-Agent": BROWSER_UA },
    type: link.includes("sr=1") ? undefined : ("m3u8" as const),
  };
}

export const vidzeeExtractor: ExtractorDef = {
  name: "Vidzee",
  mainUrl: MAIN_URL,
  extract: (link) => extractVidzee(link),
};
