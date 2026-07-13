import { buildProxyUrl, resolvePlaylistUrl } from "./proxy-url.js";

const URI_ATTR_RE = /URI="([^"]+)"/g;

export function isMasterPlaylist(body: string): boolean {
  return body.includes("#EXT-X-STREAM-INF");
}

interface StreamVariant {
  inf: string;
  url: string;
  bandwidth: number;
  audioGroup: string | null;
}

function parseBandwidth(inf: string): number {
  const match = inf.match(/BANDWIDTH=(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function parseAudioGroup(inf: string): string | null {
  const match = inf.match(/AUDIO="([^"]+)"/);
  return match ? match[1] : null;
}

function parseResolutionHeight(inf: string): number {
  const match = inf.match(/RESOLUTION=\d+x(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

/** One preferred audio track + up to 3 video rungs for ABR and quality settings. */
export interface SimplifyMasterOptions {
  maxRungs?: number;
  preferredAudioLang?: string;
  /** Max manifest rung height (default 1080; use 2160 for 4K). */
  maxHeight?: number;
}

function pickAudioLine(mediaLines: string[], preferredAudioLang?: string): string | undefined {
  const lang = preferredAudioLang?.toLowerCase().split("-")[0];
  if (lang) {
    const exact =
      mediaLines.find((l) => l.includes(`LANGUAGE="${lang}"`) && l.includes("DEFAULT=YES")) ??
      mediaLines.find((l) => l.includes(`LANGUAGE="${lang}"`)) ??
      mediaLines.find(
        (l) =>
          l.includes(`LANGUAGE="${lang}"`) ||
          new RegExp(`NAME="[^"]*${lang}[^"]*"`, "i").test(l)
      );
    if (exact) return exact;
  }

  return (
    mediaLines.find((l) => l.includes('LANGUAGE="en"') && l.includes("DEFAULT=YES")) ??
    mediaLines.find((l) => l.includes('LANGUAGE="en"')) ??
    mediaLines.find((l) => l.includes("DEFAULT=YES")) ??
    mediaLines[0]
  );
}

export function simplifyMasterForTv(
  content: string,
  maxRungsOrOptions: number | SimplifyMasterOptions = 3
): string {
  const options: SimplifyMasterOptions =
    typeof maxRungsOrOptions === "number"
      ? { maxRungs: maxRungsOrOptions }
      : maxRungsOrOptions;
  const maxRungs = options.maxRungs ?? 3;
  const preferredAudioLang = options.preferredAudioLang;
  const maxHeight = options.maxHeight ?? 1080;
  if (!isMasterPlaylist(content)) return content;

  const lines = content.split(/\r?\n/);
  const mediaLines: string[] = [];
  const variants: StreamVariant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=AUDIO")) {
      mediaLines.push(line);
    }
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const next = lines[i + 1]?.trim();
      if (next && !next.startsWith("#")) {
        variants.push({
          inf: line,
          url: next,
          bandwidth: parseBandwidth(line),
          audioGroup: parseAudioGroup(line),
        });
        i += 1;
      }
    }
  }

  if (!variants.length) return content;

  let audioLine = pickAudioLine(mediaLines, preferredAudioLang);

  const audioGroup = audioLine?.match(/GROUP-ID="([^"]+)"/)?.[1] ?? "audio0";

  const primary = variants.filter(
    (v) =>
      v.audioGroup === audioGroup &&
      !(v.audioGroup || "").includes("failover")
  );
  const pool = primary.length
    ? primary
    : variants.filter((v) => !(v.audioGroup || "").includes("failover"));
  pool.sort((a, b) => b.bandwidth - a.bandwidth);
  const capped = pool.filter((v) => {
    const h = parseResolutionHeight(v.inf);
    return h === 0 || h <= maxHeight;
  });
  const ladder = (capped.length ? capped : pool).slice(0, maxRungs);
  if (!ladder.length) return content;

  const out = ["#EXTM3U", "#EXT-X-VERSION:3"];
  if (audioLine) out.push(audioLine);
  for (const rung of ladder) {
    out.push(rung.inf, rung.url);
  }
  return out.join("\n");
}

/** Rewrite every media URL in an HLS playlist to go through our proxy */
export function rewriteM3u8(
  content: string,
  manifestUrl: string,
  publicBase: string,
  referer?: string,
  options?: SimplifyMasterOptions
): string {
  const simplified = simplifyMasterForTv(content, options ?? { maxRungs: 3 });
  const maxHeight = options?.maxHeight;
  const lines = simplified.split(/\r?\n/);
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
        return `URI="${buildProxyUrl(publicBase, absolute, referer, options?.preferredAudioLang, maxHeight)}"`;
      });
      out.push(rewritten);
      continue;
    }

    const absolute = resolvePlaylistUrl(manifestUrl, trimmed);
    out.push(buildProxyUrl(publicBase, absolute, referer, options?.preferredAudioLang, maxHeight));
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
  _url: string,
  _contentType: string | null,
  body: string
): boolean {
  return looksLikeM3u8Body(body);
}
