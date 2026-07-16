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

export interface UpstreamHeaderOptions extends ProxyHeaderParams {
  preferredAudioLang?: string;
  maxHeight?: number;
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
  return fetchWithTimeout(
    targetUrl,
    { headers: finalHeaders, redirect: "follow" },
    UPSTREAM_TIMEOUT_MS,
    fetchImpl
  );
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
 */
export async function fetchUpstreamWithRefererFallback(
  targetUrl: string,
  fetchImpl: typeof fetch = fetch,
  headerOptions?: UpstreamHeaderOptions,
  extraHeaders?: Record<string, string>
): Promise<globalThis.Response> {
  if (prefersBareUpstreamHeaders(targetUrl)) {
    const bare = await fetchOnce(targetUrl, BARE_UPSTREAM_HEADERS, fetchImpl, extraHeaders);
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
      const attempt = await fetchOnce(targetUrl, headers, fetchImpl, extraHeaders);
      if (attempt.status !== 403) return attempt;
      await drainResponseBody(attempt);
    }

    return bare;
  }

  const primary = buildUpstreamHeaders(headerOptions);
  const first = await fetchOnce(targetUrl, primary, fetchImpl, extraHeaders);

  if (first.status !== 403 || !headersIncludeOriginOrReferer(primary)) {
    return first;
  }

  await drainResponseBody(first);

  return fetchOnce(targetUrl, BARE_UPSTREAM_HEADERS, fetchImpl, extraHeaders);
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

  const upstream = await fetchUpstreamWithRefererFallback(
    targetUrl,
    fetchImpl,
    headerOptions,
    extraHeaders
  );

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
    const cacheKey = manifestCacheKey(targetUrl, headerOptions);
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
