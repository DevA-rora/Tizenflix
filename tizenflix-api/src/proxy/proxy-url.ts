import type { ProxyHeaderParams } from "./proxy-header-options.js";

/** Build a proxied URL served by our play API */
export function buildProxyUrl(
  publicBase: string,
  targetUrl: string,
  headers?: ProxyHeaderParams,
  audioLang?: string,
  maxHeight?: number
): string {
  const base = publicBase.replace(/\/$/, "");
  let url = `${base}/proxy/stream?url=${encodeURIComponent(targetUrl)}`;
  if (headers?.referer) {
    url += `&referer=${encodeURIComponent(headers.referer)}`;
  }
  if (headers?.userAgent) {
    url += `&userAgent=${encodeURIComponent(headers.userAgent)}`;
  }
  if (headers?.origin) {
    url += `&origin=${encodeURIComponent(headers.origin)}`;
  }
  if (headers?.cookie) {
    url += `&cookie=${encodeURIComponent(headers.cookie)}`;
  }
  if (audioLang) {
    url += `&audioLang=${encodeURIComponent(audioLang)}`;
  }
  if (maxHeight && maxHeight > 0) {
    url += `&maxHeight=${encodeURIComponent(String(maxHeight))}`;
  }
  return url;
}

/** Resolve relative playlist references against the manifest URL */
export function resolvePlaylistUrl(manifestUrl: string, reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return new URL(trimmed, manifestUrl).href;
}

export function parseProxyHeaderQuery(query: Record<string, unknown>): ProxyHeaderParams | undefined {
  const referer = typeof query.referer === "string" ? query.referer : undefined;
  const userAgent = typeof query.userAgent === "string" ? query.userAgent : undefined;
  const origin = typeof query.origin === "string" ? query.origin : undefined;
  const cookie = typeof query.cookie === "string" ? query.cookie : undefined;
  if (!referer && !userAgent && !origin && !cookie) return undefined;
  return { referer, userAgent, origin, cookie };
}
