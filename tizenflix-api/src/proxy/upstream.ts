import { VIDKING_HEADERS } from "../constants/headers.js";
import { fetchWithTimeout } from "../fetch-timeout.js";
import {
  IRONBUBBLE_SITE_REFERERS,
  type ProxyHeaderParams,
} from "./proxy-header-options.js";
import {
  rewriteM3u8,
  shouldRewriteAsM3u8,
  looksLikeM3u8Url,
  looksLikeM3u8ContentType,
  isMasterPlaylist,
} from "./rewrite-m3u8.js";
import { logRequest } from "./request-logger.js";
import { deduplicatedFetch } from "./request-deduplication.js";
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
const MASTER_MANIFEST_CACHE_TTL_MS = 300_000; // 5 minutes (was 60s)
const MEDIA_MANIFEST_CACHE_TTL_MS = 10_000;   // 10 seconds (new)
const RATE_LIMIT_CACHE_TTL_MS = 5_000;        // 5 seconds

interface ManifestCacheEntry {
  body: string;
  expiresAt: number;
  audioLang?: string;
  isMaster: boolean;
}

interface RateLimitEntry {
  expiresAt: number;
  retryAfter: number;
}

const manifestCache = new Map<string, ManifestCacheEntry>();
const rateLimitCache = new Map<string, RateLimitEntry>();

// LRU eviction: limit cache size
const MAX_CACHE_ENTRIES = 100;

function evictOldestCacheEntry(): void {
  if (manifestCache.size <= MAX_CACHE_ENTRIES) return;
  
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  
  for (const [key, entry] of manifestCache.entries()) {
    const age = Date.now() - (entry.expiresAt - MASTER_MANIFEST_CACHE_TTL_MS);
    if (age < oldestTime) {
      oldestTime = age;
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    manifestCache.delete(oldestKey);
  }
}

export interface UpstreamHeaderOptions extends ProxyHeaderParams {
  preferredAudioLang?: string;
  maxHeight?: number;
  tizenProfile?: boolean;
}

function manifestCacheKey(
  targetUrl: string,
  headerOptions?: UpstreamHeaderOptions
): string {
  const h = headerOptions;
  return [
    targetUrl,
    h?.referer ?? "",
    h?.userAgent ?? "",
    h?.origin ?? "",
    h?.cookie ?? "",
    h?.preferredAudioLang ?? "",
    h?.maxHeight ?? 1080,
  ].join("::");
}

export function buildUpstreamHeaders(options?: UpstreamHeaderOptions): HeadersInit {
  const base = { ...(VIDKING_HEADERS as Record<string, string>) };
  if (!options) return base;

  if (options.userAgent) base["User-Agent"] = options.userAgent;
  if (options.cookie) base.Cookie = options.cookie;

  if (options.referer) {
    base.Referer = options.referer;
    base.Origin = options.origin ?? (() => {
      try {
        return new URL(options.referer!).origin;
      } catch {
        return base.Origin;
      }
    })();
  } else if (options.origin) {
    base.Origin = options.origin;
  }

  return base;
}

function headersIncludeOriginOrReferer(headers: HeadersInit): boolean {
  const record = headers as Record<string, string>;
  return Boolean(record.Origin || record.Referer || record.origin || record.referer);
}

/**
 * Hydrogen / Yoru CDNs (moon.ironbubble.site and sibling hosts) reject forged
 * vidking.net Origin/Referer. Detect for ladder fetch policy.
 */
export function prefersBareUpstreamHeaders(targetUrl: string): boolean {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    return (
      host.includes("ironbubble") ||
      host.includes("cartlegion") ||
      /^losangeles\d*\.site$/i.test(host)
    );
  } catch {
    return false;
  }
}

async function drainResponseBody(res: globalThis.Response): Promise<void> {
  try {
    if (typeof res.arrayBuffer === "function") await res.arrayBuffer();
    else if (typeof res.text === "function") await res.text();
  } catch {
    /* ignore */
  }
}

async function fetchOnce(
  targetUrl: string,
  headers: HeadersInit,
  fetchImpl: typeof fetch,
  extraHeaders?: Record<string, string>
): Promise<globalThis.Response> {
  const finalHeaders = extraHeaders
    ? { ...(headers as Record<string, string>), ...extraHeaders }
    : headers;
  
  const startTime = Date.now();
  const response = await fetchWithTimeout(
    targetUrl,
    { headers: finalHeaders, redirect: "follow" },
    UPSTREAM_TIMEOUT_MS,
    fetchImpl
  );
  const duration = Date.now() - startTime;
  
  // Log the request
  logRequest(targetUrl, response.status, duration, {
    cached: false,
    rateLimited: response.status === 429,
  });
  
  return response;
}

async function fetchWithRateLimitHandling(
  targetUrl: string,
  headers: HeadersInit,
  fetchImpl: typeof fetch,
  extraHeaders?: Record<string, string>,
  retryCount = 0
): Promise<globalThis.Response> {
  const maxRetries = 3;
  
  // Check rate limit cache
  const rateLimitEntry = rateLimitCache.get(targetUrl);
  if (rateLimitEntry && rateLimitEntry.expiresAt > Date.now()) {
    // Still rate limited - return cached 429 or wait
    const waitMs = rateLimitEntry.retryAfter;
    if (retryCount === 0) {
      console.log(`[PROXY] Rate limit cached for ${extractHostname(targetUrl)}, waiting ${waitMs}ms`);
      await sleep(waitMs);
    } else {
      throw new Error(`Rate limited: ${targetUrl.substring(0, 100)}`);
    }
  }
  
  const response = await fetchOnce(targetUrl, headers, fetchImpl, extraHeaders);
  
  if (response.status === 429) {
    // Parse Retry-After header if present
    const retryAfter = response.headers.get("retry-after");
    let waitMs = Math.min(1000 * Math.pow(2, retryCount), 8000); // Exponential backoff: 1s, 2s, 4s, 8s
    
    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed)) {
        waitMs = parsed * 1000;
      }
    }
    
    // Cache the rate limit
    rateLimitCache.set(targetUrl, {
      expiresAt: Date.now() + RATE_LIMIT_CACHE_TTL_MS,
      retryAfter: waitMs,
    });
    
    if (retryCount < maxRetries) {
      console.log(`[PROXY] 429 Rate Limited - retry ${retryCount + 1}/${maxRetries} after ${waitMs}ms`);
      await sleep(waitMs);
      // Drain the response body before retry
      await drainResponseBody(response);
      return fetchWithRateLimitHandling(targetUrl, headers, fetchImpl, extraHeaders, retryCount + 1);
    }
  }
  
  return response;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function refererAttemptsForIronbubble(headerOptions?: UpstreamHeaderOptions): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (ref?: string) => {
    if (!ref || seen.has(ref)) return;
    seen.add(ref);
    out.push(ref);
  };
  add(headerOptions?.referer);
  for (const ref of IRONBUBBLE_SITE_REFERERS) add(ref);
  return out;
}

/**
 * Fetch upstream with per-source headers (Referer, UA, Cookie).
 * Ironbubble: bare UA → site-referer ladder (fmovies, cineby, videasy, …).
 * Other hosts: full headers → bare UA on 403.
 * Includes: rate limit handling, exponential backoff, request deduplication.
 */
export async function fetchUpstreamWithRefererFallback(
  targetUrl: string,
  fetchImpl: typeof fetch = fetch,
  headerOptions?: UpstreamHeaderOptions,
  extraHeaders?: Record<string, string>
): Promise<globalThis.Response> {
  // Wrap the entire fetch logic in deduplication
  return deduplicatedFetch(
    targetUrl,
    async () => {
      if (prefersBareUpstreamHeaders(targetUrl)) {
        const bare = await fetchWithRateLimitHandling(
          targetUrl,
          BARE_UPSTREAM_HEADERS,
          fetchImpl,
          extraHeaders
        );
        if (bare.status !== 403) return bare;
        await drainResponseBody(bare);

        for (const referer of refererAttemptsForIronbubble(headerOptions)) {
          const headers = buildUpstreamHeaders({
            ...headerOptions,
            referer,
            origin: (() => {
              try {
                return new URL(referer).origin;
              } catch {
                return headerOptions?.origin;
              }
            })(),
          });
          const attempt = await fetchWithRateLimitHandling(
            targetUrl,
            headers,
            fetchImpl,
            extraHeaders
          );
          if (attempt.status !== 403) return attempt;
          await drainResponseBody(attempt);
        }

        return bare;
      }

      const primary = buildUpstreamHeaders(headerOptions);
      const first = await fetchWithRateLimitHandling(targetUrl, primary, fetchImpl, extraHeaders);

      if (first.status !== 403 || !headersIncludeOriginOrReferer(primary)) {
        return first;
      }

      await drainResponseBody(first);

      return fetchWithRateLimitHandling(
        targetUrl,
        BARE_UPSTREAM_HEADERS,
        fetchImpl,
        extraHeaders
      );
    },
    buildUpstreamHeaders(headerOptions)
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
  headerOptions?: UpstreamHeaderOptions,
  rangeHeader?: string
): Promise<void> {
  // Forward the client's Range request upstream so Tizen/native players that
  // require partial-content (206) get it. Desktop hls.js/MSE does not send Range,
  // so this is additive and does not affect the working browser path.
  const extraHeaders =
    typeof rangeHeader === "string" && rangeHeader ? { Range: rangeHeader } : undefined;

  const startTime = Date.now();
  const upstream = await fetchUpstreamWithRefererFallback(
    targetUrl,
    fetchImpl,
    headerOptions,
    extraHeaders
  );
  const duration = Date.now() - startTime;

  // Log segment fetch (already logged in fetchOnce, but this catches the result)
  res.status(upstream.status);
  const contentType = upstream.headers.get("content-type");
  if (contentType) res.setHeader("content-type", contentType);
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader(
    "access-control-expose-headers",
    "Content-Length, Content-Range, Accept-Ranges"
  );
  // Advertise/propagate range capability so TV players issue and trust seeks.
  res.setHeader("accept-ranges", upstream.headers.get("accept-ranges") || "bytes");
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) res.setHeader("content-range", contentRange);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) res.setHeader("content-length", contentLength);
  
  // Longer cache for segments (they don't change)
  res.setHeader("cache-control", "public, max-age=3600, immutable");

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
  const startTime = Date.now();
  const upstream = await fetchUpstreamWithRefererFallback(
    targetUrl,
    fetchImpl,
    headerOptions
  );

  const contentType = upstream.headers.get("content-type");

  const mightBeM3u8 =
    looksLikeM3u8Url(targetUrl) || looksLikeM3u8ContentType(contentType);

  if (mightBeM3u8) {
    const cacheKey = manifestCacheKey(targetUrl, headerOptions);
    const cached = manifestCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const duration = Date.now() - startTime;
      logRequest(targetUrl, 200, duration, { cached: true });
      return {
        status: 200,
        contentType: "application/vnd.apple.mpegurl",
        body: cached.body,
        rewritten: true,
      };
    }

    const text = await upstream.text();
    if (upstream.ok && shouldRewriteAsM3u8(targetUrl, contentType, text)) {
      const proxyHeaders: ProxyHeaderParams | undefined = headerOptions
        ? {
            referer: headerOptions.referer,
            userAgent: headerOptions.userAgent,
            origin: headerOptions.origin,
            cookie: headerOptions.cookie,
          }
        : undefined;
      const rewritten = rewriteM3u8(text, targetUrl, publicBase, proxyHeaders, {
        preferredAudioLang: headerOptions?.preferredAudioLang,
        maxHeight: headerOptions?.maxHeight,
        tizenProfile: headerOptions?.tizenProfile,
      });
      
      // Determine if master or media playlist for cache TTL
      const isMaster = isMasterPlaylist(text);
      const cacheTTL = isMaster ? MASTER_MANIFEST_CACHE_TTL_MS : MEDIA_MANIFEST_CACHE_TTL_MS;
      
      // Evict old entries if cache is too large
      evictOldestCacheEntry();
      
      manifestCache.set(cacheKey, {
        body: rewritten,
        expiresAt: Date.now() + cacheTTL,
        audioLang: headerOptions?.preferredAudioLang,
        isMaster,
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
