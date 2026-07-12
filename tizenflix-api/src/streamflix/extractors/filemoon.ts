import { createDecipheriv, createHash, createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import type { ExtractedVideo } from "../types.js";
import { BROWSER_UA, fetchJson, fetchJsonPost } from "../http.js";

const MAIN_URL = "https://filemoon.site";
const ALIAS_URLS = [
  "https://bf0skv.org",
  "https://filemoon.sx",
  "https://moflix-stream.link",
];

interface DetailsResponse {
  embed_frame_url?: string;
}

interface ChallengeResponse {
  challenge_id?: string;
  nonce?: string;
}

interface AttestResponse {
  token?: string;
  viewer_id?: string;
  device_id?: string;
  confidence?: number;
}

interface PlaybackData {
  iv: string;
  payload: string;
  key_parts: string[];
}

interface PlaybackResponse {
  playback?: PlaybackData;
}

function stripLeadingZero(buf: Buffer): Buffer {
  if (buf.length > 0 && buf[0] === 0) return buf.subarray(1);
  return buf;
}

function derToRawSignature(der: Buffer): Buffer {
  let offset = 2;
  const rLen = der[offset + 1]!;
  const r = stripLeadingZero(der.subarray(offset + 2, offset + 2 + rLen));
  offset += 2 + rLen;
  const sLen = der[offset + 1]!;
  const s = stripLeadingZero(der.subarray(offset + 2, offset + 2 + sLen));
  const raw = Buffer.alloc(64);
  r.copy(raw, 32 - r.length);
  s.copy(raw, 64 - s.length);
  return raw;
}

function generateAttestation(nonce: string): { signature: string; publicKey: Record<string, unknown> } {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubJwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };

  const sign = createSign("SHA256");
  sign.update(nonce);
  sign.end();
  const derSig = sign.sign(privateKey);
  const rawSig = derToRawSignature(derSig);

  return {
    signature: rawSig.toString("base64url"),
    publicKey: {
      crv: "P-256",
      ext: true,
      key_ops: ["verify"],
      kty: "EC",
      x: pubJwk.x,
      y: pubJwk.y,
    },
  };
}

function decryptPlayback(data: PlaybackData): string {
  const iv = Buffer.from(data.iv, "base64url");
  const payload = Buffer.from(data.payload, "base64url");
  const p1 = Buffer.from(data.key_parts[0]!, "base64url");
  const p2 = Buffer.from(data.key_parts[1]!, "base64url");
  const key = Buffer.concat([p1, p2]);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  const tagLen = 16;
  const ciphertext = payload.subarray(0, payload.length - tagLen);
  const authTag = payload.subarray(payload.length - tagLen);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export const filemoonExtractor = {
  name: "Filemoon",
  mainUrl: MAIN_URL,
  aliasUrls: ALIAS_URLS,
  async extract(link: string): Promise<ExtractedVideo> {
    const matcher = link.match(/\/(e|d)\/([a-zA-Z0-9]+)/);
    if (!matcher) throw new Error("Filemoon: could not extract video ID");
    const linkType = matcher[1]!;
    const videoId = matcher[2]!;

    const currentDomain = link.match(/(https?:\/\/[^/]+)/)?.[1];
    if (!currentDomain) throw new Error("Filemoon: no base URL");

    let deviceId = randomUUID().replace(/-/g, "");

    const details = await fetchJson<DetailsResponse>(
      `${currentDomain}/api/videos/${videoId}/embed/details`
    );
    const embedFrameUrl = details.embed_frame_url;
    if (!embedFrameUrl) throw new Error("Filemoon: embed_frame_url missing");

    const playbackDomain = embedFrameUrl.match(/(https?:\/\/[^/]+)/)?.[1];
    if (!playbackDomain) throw new Error("Filemoon: playback domain missing");

    const challenge = await fetchJsonPost<ChallengeResponse>(
      `${playbackDomain}/api/videos/access/challenge`,
      {},
      {
        Referer: embedFrameUrl,
        Origin: playbackDomain,
        "User-Agent": BROWSER_UA,
      }
    );

    const challengeId = challenge.challenge_id;
    const nonce = challenge.nonce;
    if (!challengeId || !nonce) throw new Error("Filemoon: challenge incomplete");

    let viewerId = randomUUID().replace(/-/g, "");
    const attestation = generateAttestation(nonce);

    const attestResponse = await fetchJsonPost<AttestResponse>(
      `${playbackDomain}/api/videos/access/attest`,
      {
        viewer_id: viewerId,
        device_id: deviceId,
        challenge_id: challengeId,
        nonce,
        signature: attestation.signature,
        public_key: attestation.publicKey,
        client: {
          user_agent: BROWSER_UA,
          architecture: "x86",
          bitness: "64",
          platform: "Windows",
          platform_version: "10.0.0",
          pixel_ratio: 1.0,
          screen_width: 1920,
          screen_height: 1080,
          languages: ["en-US"],
        },
        storage: {
          cookie: viewerId,
          local_storage: viewerId,
          indexed_db: `${viewerId}:${deviceId}`,
          cache_storage: `${viewerId}:${deviceId}`,
        },
        attributes: { entropy: "high" },
      },
      {
        Referer: embedFrameUrl,
        Origin: playbackDomain,
        "User-Agent": BROWSER_UA,
      }
    );

    const token = attestResponse.token;
    if (!token) throw new Error("Filemoon: no attest token");
    viewerId = attestResponse.viewer_id ?? viewerId;
    deviceId = attestResponse.device_id ?? deviceId;
    const confidence = attestResponse.confidence ?? 0;

    const playbackResponse = await fetchJsonPost<PlaybackResponse>(
      `${playbackDomain}/api/videos/${videoId}/embed/playback`,
      {
        fingerprint: {
          token,
          viewer_id: viewerId,
          device_id: deviceId,
          confidence,
        },
      },
      {
        Referer: embedFrameUrl,
        Origin: playbackDomain,
        "X-Embed-Parent": linkType === "e" ? link : "",
        "User-Agent": BROWSER_UA,
      }
    );

    const playbackData = playbackResponse.playback;
    if (!playbackData) throw new Error("Filemoon: no playback data");

    const decryptedJson = decryptPlayback(playbackData);
    const parsed = JSON.parse(decryptedJson) as { sources?: Array<{ url?: string }> };
    const sourceUrl = parsed.sources?.[0]?.url;
    if (!sourceUrl) throw new Error("Filemoon: no source URL");

    return {
      source: sourceUrl,
      subtitles: [],
      headers: {
        Referer: embedFrameUrl,
        "User-Agent": BROWSER_UA,
        Origin: playbackDomain,
      },
    };
  },
};
