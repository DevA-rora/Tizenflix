import { VIDKING_HEADERS } from "../constants/headers.js";
import { fetchWithTimeout } from "../fetch-timeout.js";
import {
  rewriteM3u8,
  shouldRewriteAsM3u8,
  looksLikeM3u8Url,
  looksLikeM3u8ContentType,
} from "./rewrite-m3u8.js";
import type { Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const UPSTREAM_HEADERS: HeadersInit = {
  ...VIDKING_HEADERS,
};

/** UA/Accept only — some CDNs (ironbubble / Hydrogen) 403 when Origin/Referer is set. */
export const BARE_UPSTREAM_HEADERS: HeadersInit = {
  Accept: "*/*",
  "User-Agent": (VIDKING_HEADERS as Record<string, string>)["User-Agent"]!,
};

const UPSTREAM_TIMEOUT_MS = 12_000;
const MANIFEST_CACHE_TTL_MS = 60_000;

interface ManifestCacheEntry {
  body: string;
  expiresAt: number;
  audioLang?: string;
}

const manifestCache = new Map<string, ManifestCacheEntry>();

function manifestCacheKey(
  targetUrl: string,
  preferredAudioLang?: string,
  maxHeight?: number
): string {
  return `${targetUrl}::${preferredAudioLang ?? ""}::${maxHeight ?? 1080}`;
}

export interface UpstreamHeaderOptions {
  referer?: string;
  preferredAudioLang?: string;
  maxHeight?: number;
}

export function buildUpstreamHeaders(options?: UpstreamHeaderOptions): HeadersInit {
  if (!options?.referer) return UPSTREAM_HEADERS;
  const base = VIDKING_HEADERS as Record<string, string>;
  let origin = base.Origin;
  try {
    origin = new URL(options.referer).origin;
  } catch {
    /* keep default */
  }
  return {
    ...base,
    Referer: options.referer,
    Origin: origin,
  };
}

function headersIncludeOriginOrReferer(headers: HeadersInit): boolean {
  const record = headers as Record<string, string>;
  return Boolean(record.Origin || record.Referer || record.origin || record.referer);
}

/**
 * Fetch upstream with Vidking (or custom referer) headers.
 * On HTTP 403, retry once without Origin/Referer — needed for Hydrogen/ironbubble CDNs
 * that reject forged vidking.net referers while accepting bare browser UA requests.
 */
export async function fetchUpstreamWithRefererFallback(
  targetUrl: string,
  fetchImpl: typeof fetch = fetch,
  headerOptions?: UpstreamHeaderOptions
): Promise<globalThis.Response> {
  const primary = buildUpstreamHeaders(headerOptions);
  const first = await fetchWithTimeout(
    targetUrl,
    { headers: primary, redirect: "follow" },
    UPSTREAM_TIMEOUT_MS,
    fetchImpl
  );

  if (first.status !== 403 || !headersIncludeOriginOrReferer(primary)) {
    return first;
  }

  // Drain body so the connection can close before retry (mocks may omit arrayBuffer).
  try {
    if (typeof first.arrayBuffer === "function") await first.arrayBuffer();
    else if (typeof first.text === "function") await first.text();
  } catch {
    /* ignore */
  }

  return fetchWithTimeout(
    targetUrl,
    { headers: BARE_UPSTREAM_HEADERS, redirect: "follow" },
    UPSTREAM_TIMEOUT_MS,
    fetchImpl
  );
}

export interface ProxyStreamResult {
  status: number;
  contentType: string | null;
  body: string | Uint8Array;
  rewritten: boolean;
}

export function looksLikeBinarySegment(url: string): boolean {
  return /\.(ts|m4s)(\?|$|\.)/i.test(url);
}

/** Stream binary segments through without buffering the full body in memory. */
export async function pipeProxiedStream(
  targetUrl: string,
  res: Response,
  fetchImpl: typeof fetch = fetch,
  headerOptions?: UpstreamHeaderOptions
): Promise<void> {
  const upstream = await fetchUpstreamWithRefererFallback(
    targetUrl,
    fetchImpl,
    headerOptions
  );

  res.status(upstream.status);
  const contentType = upstream.headers.get("content-type");
  if (contentType) res.setHeader("content-type", contentType);
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "public, max-age=3600");

  if (!upstream.body) {
    res.end();
    return;
  }

  await pipeline(Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream), res);
}

/** Fetch upstream media; rewrite m3u8 playlists for Tizen-safe playback */
export async function fetchProxiedStream(
  targetUrl: string,
  publicBase: string,
  fetchImpl: typeof fetch = fetch,
  headerOptions?: UpstreamHeaderOptions
): Promise<ProxyStreamResult> {
  const upstream = await fetchUpstreamWithRefererFallback(
    targetUrl,
    fetchImpl,
    headerOptions
  );

  const contentType = upstream.headers.get("content-type");

  const mightBeM3u8 =
    looksLikeM3u8Url(targetUrl) || looksLikeM3u8ContentType(contentType);

  if (mightBeM3u8) {
    const cacheKey = manifestCacheKey(
      targetUrl,
      headerOptions?.preferredAudioLang,
      headerOptions?.maxHeight
    );
    const cached = manifestCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        status: 200,
        contentType: "application/vnd.apple.mpegurl",
        body: cached.body,
        rewritten: true,
      };
    }

    const text = await upstream.text();
    if (upstream.ok && shouldRewriteAsM3u8(targetUrl, contentType, text)) {
      const rewritten = rewriteM3u8(text, targetUrl, publicBase, headerOptions?.referer, {
        preferredAudioLang: headerOptions?.preferredAudioLang,
        maxHeight: headerOptions?.maxHeight,
      });
      manifestCache.set(cacheKey, {
        body: rewritten,
        expiresAt: Date.now() + MANIFEST_CACHE_TTL_MS,
        audioLang: headerOptions?.preferredAudioLang,
      });
      return {
        status: upstream.status,
        contentType: "application/vnd.apple.mpegurl",
        body: rewritten,
        rewritten: true,
      };
    }
    return {
      status: upstream.status,
      contentType,
      body: text,
      rewritten: false,
    };
  }

  const buffer = new Uint8Array(await upstream.arrayBuffer());
  return {
    status: upstream.status,
    contentType,
    body: buffer,
    rewritten: false,
  };
}
