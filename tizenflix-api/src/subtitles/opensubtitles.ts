import { fetchWithTimeout } from "../fetch-timeout.js";
import { BROWSER_UA } from "../streamflix/http.js";
import type { PlayResponse } from "../types.js";

const OPENSUBTITLES_BASE = "https://rest.opensubtitles.org";

export interface OpenSubtitleEntry {
  IDSubtitleFile: string;
  SubLanguageID: string;
  LanguageName: string;
  SubFileName: string;
  SubDownloadLink: string;
  SubFormat: string;
  MovieReleaseName?: string;
}

export async function searchOpenSubtitles(options: {
  imdbId?: string;
  query?: string;
  season?: number;
  episode?: number;
  language?: string;
}): Promise<OpenSubtitleEntry[]> {
  const parts: string[] = [];
  if (options.imdbId) parts.push(`imdbid-${options.imdbId.replace(/^tt/, "")}`);
  if (options.query) parts.push(`query-${options.query.toLowerCase()}`);
  if (options.season != null) parts.push(`season-${options.season}`);
  if (options.episode != null) parts.push(`episode-${options.episode}`);
  if (options.language) parts.push(`sublanguageid-${options.language}`);

  if (!parts.length) return [];

  const url = `${OPENSUBTITLES_BASE}/search/${parts.join("/")}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "Tizenflix v0.2",
          Accept: "application/json",
        },
      },
      15_000
    );
  } catch {
    return [];
  }

  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ Subs?: OpenSubtitleEntry[] }>;
  const subs: OpenSubtitleEntry[] = [];
  for (const group of data) {
    if (group.Subs) subs.push(...group.Subs);
  }
  return subs;
}

export async function fetchOpenSubtitleVtt(downloadUrl: string): Promise<string | null> {
  const res = await fetchWithTimeout(
    downloadUrl,
    { headers: { "User-Agent": BROWSER_UA } },
    20_000
  );
  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  // OpenSubtitles returns gzipped zip — try gunzip first
  try {
    const { gunzipSync } = await import("node:zlib");
    const decompressed = gunzipSync(buffer);
    const text = decompressed.toString("utf8");
    if (text.includes("WEBVTT") || text.includes("-->")) return text;
    // May be SRT inside zip — basic SRT to VTT
    if (text.match(/\d+\s*\n\d{2}:\d{2}:\d{2}/)) {
      return srtToVtt(text);
    }
    return text;
  } catch {
    const text = buffer.toString("utf8");
    if (text.includes("WEBVTT")) return text;
    return null;
  }
}

function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r/g, "")
    .replace(/^\d+\s*$/gm, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body.trim()}\n`;
}

export async function enrichWithOpenSubtitles(
  play: PlayResponse,
  meta: { imdbId?: string; title?: string },
  publicBase?: string
): Promise<PlayResponse> {
  if (play.subtitles.length >= 3) return play;

  const subs = await searchOpenSubtitles({
    imdbId: meta.imdbId,
    query: meta.title,
    season: play.type === "tv" && play.season ? parseInt(play.season, 10) : undefined,
    episode: play.type === "tv" && play.episode ? parseInt(play.episode, 10) : undefined,
    language: "eng",
  });

  const seen = new Set(play.subtitles.map((s) => s.language));
  const base = publicBase ? publicBase.replace(/\/$/, "") : "";
  const extra = subs.slice(0, 5).map((sub, i) => ({
    id: `sub-os-${sub.IDSubtitleFile || i}`,
    language: sub.SubLanguageID || "eng",
    label: `${sub.LanguageName || "English"} (OpenSubtitles)`,
    url: base
      ? `${base}/subtitle/opensubtitles?download=${encodeURIComponent(sub.SubDownloadLink)}`
      : sub.SubDownloadLink,
    default: false,
  }));

  for (const track of extra) {
    if (seen.has(track.language)) continue;
    play.subtitles.push(track);
    seen.add(track.language);
  }

  return play;
}
