const TTL_MS = 5 * 60 * 1000;

export const INLINE_MANIFEST_PREFIX = "tizenflix-inline-manifest:";

export interface InlineManifestEntry {
  body: string;
  upstreamUrl: string;
  referer?: string;
  expiresAt: number;
}

const cache = new Map<string, InlineManifestEntry>();

export function storeInlineManifest(
  body: string,
  upstreamUrl: string,
  referer?: string
): string {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  cache.set(token, {
    body,
    upstreamUrl,
    referer,
    expiresAt: Date.now() + TTL_MS,
  });
  return token;
}

export function getInlineManifest(token: string): InlineManifestEntry | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(token);
    return null;
  }
  return entry;
}

export function isInlineManifestSource(url: string): boolean {
  return url.startsWith(INLINE_MANIFEST_PREFIX);
}

export function inlineManifestToken(url: string): string | null {
  if (!isInlineManifestSource(url)) return null;
  return url.slice(INLINE_MANIFEST_PREFIX.length);
}
