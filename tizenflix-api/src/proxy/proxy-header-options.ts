import type { PlayableSource } from "../types.js";

/** Headers replayed on every proxied CDN request (manifest + segments). */
export interface ProxyHeaderParams {
  referer?: string;
  userAgent?: string;
  origin?: string;
  cookie?: string;
}

export function proxyHeadersFromRecord(
  headers?: Record<string, string>
): ProxyHeaderParams | undefined {
  if (!headers || !Object.keys(headers).length) return undefined;
  const referer = headers.Referer ?? headers.referer;
  const userAgent = headers["User-Agent"] ?? headers["user-agent"];
  const origin = headers.Origin ?? headers.origin;
  const cookie = headers.Cookie ?? headers.cookie;
  if (!referer && !userAgent && !origin && !cookie) return undefined;
  return { referer, userAgent, origin, cookie };
}

export function proxyHeadersFromSource(source: PlayableSource): ProxyHeaderParams | undefined {
  return proxyHeadersFromRecord(source.upstreamHeaders);
}

/** Site referers accepted by ironbubble / Hydrogen CDNs (fmovies Yoru path). */
export const IRONBUBBLE_SITE_REFERERS: string[] = [
  "https://www.fmovies.gd/",
  "https://fmovies.gd/",
  "https://www.cineby.app/",
  "https://cineby.app/",
  "https://player.videasy.net/",
  "https://www.vidking.net/",
  "https://1movies.life/",
];

/** Default CDN headers for Vidking server names when scraper did not attach any. */
export function defaultUpstreamHeadersForProvider(provider: string): Record<string, string> | undefined {
  const lower = provider.toLowerCase();
  if (lower === "hydrogen") {
    return {
      Referer: "https://www.fmovies.gd/",
      Origin: "https://www.fmovies.gd",
    };
  }
  if (lower === "oxygen" || lower === "titanium" || lower === "helium" || lower === "lithium") {
    return {
      Referer: "https://www.vidking.net/",
      Origin: "https://www.vidking.net",
    };
  }
  return undefined;
}

export function mergeProxyHeaderParams(
  base?: ProxyHeaderParams,
  override?: ProxyHeaderParams
): ProxyHeaderParams | undefined {
  if (!base && !override) return undefined;
  return { ...base, ...override };
}
