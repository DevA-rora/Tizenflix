/** Build a proxied URL served by our play API */
export function buildProxyUrl(
  publicBase: string,
  targetUrl: string,
  referer?: string
): string {
  const base = publicBase.replace(/\/$/, "");
  let url = `${base}/proxy/stream?url=${encodeURIComponent(targetUrl)}`;
  if (referer) {
    url += `&referer=${encodeURIComponent(referer)}`;
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
