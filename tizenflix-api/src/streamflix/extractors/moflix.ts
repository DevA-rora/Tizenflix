import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { fetchJson } from "../http.js";
import { extractVideo } from "./registry.js";

const MOFLIX_BASE = "https://moflix-stream.xyz/";

const MOFLIX_HEADERS = {
  Referer: MOFLIX_BASE,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
};

interface MoflixVideoItem {
  id?: number;
  name?: string;
  src?: string;
  playback_resolve_url?: string;
  premium_locked?: boolean;
}

interface MoflixResponse {
  title?: { id?: string; videos?: MoflixVideoItem[] };
  episode?: { id?: string; videos?: MoflixVideoItem[] };
  videos?: MoflixVideoItem[];
}

interface MoflixPlaybackResponse {
  src?: string;
}

function encodeTmdbId(type: "movie" | "tv", tmdbId: string): string {
  const raw = type === "movie" ? `tmdb|movie|${tmdbId}` : `tmdb|series|${tmdbId}`;
  return Buffer.from(raw, "utf8").toString("base64");
}

export async function buildMoflixEntries(opts: {
  type: "movie" | "tv";
  tmdbId: string;
  season?: string;
  episode?: string;
}): Promise<Array<{ name: string; url: string }>> {
  const base = MOFLIX_BASE;

  let url: string;
  if (opts.type === "movie") {
    const id = encodeTmdbId("movie", opts.tmdbId);
    url = `${base}api/v1/titles/${id}?loader=titlePage`;
  } else {
    const id = encodeTmdbId("tv", opts.tmdbId);
    let mediaId = id;
    try {
      const titleRes = await fetchJson<MoflixResponse>(
        `${base}api/v1/titles/${id}?loader=titlePage`,
        { headers: MOFLIX_HEADERS, referer: base }
      );
      mediaId = titleRes.title?.id ?? id;
    } catch {
      /* use encoded id */
    }
    url = `${base}api/v1/titles/${mediaId}/seasons/${opts.season ?? "1"}/episodes/${opts.episode ?? "1"}?loader=episodePage`;
  }

  const response = await fetchJson<MoflixResponse>(url, {
    headers: MOFLIX_HEADERS,
    referer: base,
  });

  const videos =
    response.videos ??
    response.title?.videos ??
    response.episode?.videos ??
    [];

  const entries: Array<{ name: string; url: string }> = [];
  for (const video of videos) {
    const src = video.src ?? "";
    const resolveUrl = video.playback_resolve_url ?? "";
    if (!src && !resolveUrl) continue;
    if (video.premium_locked) continue;
    const finalSrc = resolveUrl ? `${base}api/v1/${resolveUrl}` : src;
    entries.push({
      name: `Moflix - ${video.name ?? "Mirror"}`,
      url: finalSrc,
    });
  }
  return entries;
}

async function extractMoflix(link: string): Promise<ExtractedVideo> {
  if (link.includes("/playback") || link.includes(".m3u8")) {
    if (link.includes("/playback")) {
      const videoId = link.split("videos/")[1]?.split("/playback")[0] ?? "";
      try {
        const playback = await fetchJson<MoflixPlaybackResponse>(link, {
          headers: MOFLIX_HEADERS,
          referer: `${MOFLIX_BASE}watch/${videoId}`,
        });
        if (playback.src) {
          return { source: playback.src, subtitles: [], headers: { Referer: MOFLIX_BASE } };
        }
      } catch {
        /* fall through */
      }
    } else {
      return { source: link, subtitles: [], headers: { Referer: MOFLIX_BASE } };
    }
  }
  return extractVideo(link);
}

/** Ported from Streamflix MoflixExtractor */
export const moflixExtractor: ExtractorDef = {
  name: "Moflix",
  mainUrl: MOFLIX_BASE,
  aliasUrls: ["https://moflix-stream.xyz"],
  extract: extractMoflix,
};
