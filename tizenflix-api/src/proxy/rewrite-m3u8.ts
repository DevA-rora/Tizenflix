import { buildProxyUrl, resolvePlaylistUrl } from "./proxy-url.js";

const URI_ATTR_RE = /URI="([^"]+)"/g;

/** Rewrite every media URL in an HLS playlist to go through our proxy */
export function rewriteM3u8(
  content: string,
  manifestUrl: string,
  publicBase: string
): string {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.startsWith("#")) {
      const rewritten = trimmed.replace(URI_ATTR_RE, (_match, uri: string) => {
        const absolute = resolvePlaylistUrl(manifestUrl, uri);
        return `URI="${buildProxyUrl(publicBase, absolute)}"`;
      });
      out.push(rewritten);
      continue;
    }

    const absolute = resolvePlaylistUrl(manifestUrl, trimmed);
    out.push(buildProxyUrl(publicBase, absolute));
  }

  return out.join("\n");
}

export function looksLikeM3u8Url(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes(".m3u8") || lower.includes("m3u8?");
}

export function looksLikeM3u8Body(body: string): boolean {
  return body.trimStart().startsWith("#EXTM3U");
}

export function looksLikeM3u8ContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return /mpegurl|m3u8/i.test(contentType);
}

export function shouldRewriteAsM3u8(
  url: string,
  contentType: string | null,
  body: string
): boolean {
  if (looksLikeM3u8Body(body)) return true;
  if (looksLikeM3u8ContentType(contentType)) return true;
  if (looksLikeM3u8Url(url)) return true;
  return false;
}
