/** Build a proxied URL served by our play API */
export function buildProxyUrl(publicBase: string, targetUrl: string): string {
  const base = publicBase.replace(/\/$/, "");
  return `${base}/proxy/stream?url=${encodeURIComponent(targetUrl)}`;
}

/** Resolve relative playlist references against the manifest URL */
export function resolvePlaylistUrl(manifestUrl: string, reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return new URL(trimmed, manifestUrl).href;
}
