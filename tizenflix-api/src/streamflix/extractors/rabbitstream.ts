import { createDecipheriv, createHash } from "node:crypto";
import type { ExtractedVideo } from "../types.js";
import { fetchJson } from "../http.js";

const KEYS_URL = "https://keys4.fun";

interface RabbitKeysResponse {
  rabbitstream: {
    keys: { key: string };
  };
}

interface RabbitTrack {
  file?: string;
  label?: string;
  kind?: string;
}

interface RabbitSource {
  file?: string;
  type?: string;
}

interface RabbitSources {
  sources: RabbitSource[];
  tracks: RabbitTrack[];
}

interface RabbitEncrypted {
  sources: string;
  tracks: RabbitTrack[];
}

type RabbitResponse = RabbitSources | RabbitEncrypted;

function isEncrypted(r: RabbitResponse): r is RabbitEncrypted {
  return typeof (r as RabbitEncrypted).sources === "string";
}

function md5(input: Buffer): Buffer {
  return createHash("md5").update(input).digest();
}

function generateKey(salt: Buffer, secret: Buffer): Buffer {
  let output = md5(Buffer.concat([secret, salt]));
  let currentKey = output;
  while (currentKey.length < 48) {
    output = md5(Buffer.concat([output, secret, salt]));
    currentKey = Buffer.concat([currentKey, output]);
  }
  return currentKey;
}

function decryptSourceUrl(decryptionKey: Buffer, sourceUrl: string): string {
  const cipherData = Buffer.from(sourceUrl, "base64");
  const encrypted = cipherData.subarray(16);
  const iv = decryptionKey.subarray(32);
  const key = decryptionKey.subarray(0, 32);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function decryptRabbit(encrypted: RabbitEncrypted, key: string): RabbitSources {
  const salt = Buffer.from(encrypted.sources, "base64").subarray(8, 16);
  const decryptionKey = generateKey(salt, Buffer.from(key, "utf8"));
  const decrypted = decryptSourceUrl(decryptionKey, encrypted.sources);
  return {
    sources: JSON.parse(decrypted) as RabbitSource[],
    tracks: encrypted.tracks,
  };
}

async function extractRabbit(link: string, mainUrl: string): Promise<ExtractedVideo> {
  const sourceId = link.split("?")[0]!.split("/").pop()!;
  const keys = await fetchJson<RabbitKeysResponse>(KEYS_URL);
  const rabbitKey = keys.rabbitstream.keys.key;

  const apiUrl = process.env.RABBITSTREAM_SOURCE_API ?? `https://rabbitstream.net/ajax/embed-4/getSources?id=`;
  const response = await fetchJson<RabbitResponse>(`${apiUrl}${sourceId}`);

  const sources = isEncrypted(response)
    ? decryptRabbit(response, rabbitKey)
    : response;

  const source = sources.sources.map((s) => s.file).find(Boolean);
  if (!source) throw new Error("Rabbitstream: no source");

  const subtitles = sources.tracks
    .filter((t) => t.kind === "captions" && t.file)
    .map((t) => ({
      label: t.label ?? "Unknown",
      file: t.file!,
    }));

  return {
    source,
    subtitles,
    headers: { Referer: mainUrl },
  };
}

export const rabbitstreamExtractor = {
  name: "Rabbitstream",
  mainUrl: "https://rabbitstream.net",
  aliasUrls: ["https://megacloud.blog", "https://videostr.net", "https://dokicloud.one"],
  extract: (link: string) => extractRabbit(link, "https://rabbitstream.net"),
};

export const megacloudExtractor = {
  name: "Megacloud",
  mainUrl: "https://megacloud.blog",
  aliasUrls: ["https://videostr.net"],
  extract: (link: string) => extractRabbit(link, "https://megacloud.blog"),
};
