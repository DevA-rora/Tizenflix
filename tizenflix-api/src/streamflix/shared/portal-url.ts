/** Dynamic provider base URL resolution — port of Streamflix ProviderConfigUrl / ProviderPortalUrl */

import { fetchText } from "../http.js";

const cache = new Map<string, { url: string; expires: number }>();
const CACHE_MS = 30 * 60 * 1000;

export interface PortalConfig {
  portalUrl: string;
  /** CSS selector or regex to extract the new base URL from portal HTML */
  extractPattern?: RegExp;
}

/**
 * Fetch current base URL from a portal/tracker page.
 * Used by Wiflix, FrenchStream, Altadefinizione, GuardaFlix, etc.
 */
export async function resolvePortalBaseUrl(
  key: string,
  config: PortalConfig,
  fallback: string
): Promise<string> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.url;

  try {
    const html = await fetchText(config.portalUrl, { timeoutMs: 15000 });
    const pattern =
      config.extractPattern ??
      /href="(https?:\/\/[^"]+)"[^>]*class="[^"]*btn[^"]*"/i;
    const m = html.match(pattern) ?? html.match(/(https?:\/\/[a-z0-9.-]+\.[a-z]{2,}\/?)/i);
    const url = m?.[1]?.replace(/\/$/, "") ?? fallback;
    cache.set(key, { url, expires: now + CACHE_MS });
    return url;
  } catch {
    return fallback;
  }
}

export function clearPortalCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
