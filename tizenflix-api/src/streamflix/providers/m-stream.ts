import type { ContentProvider } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { fetchJson } from "../network/client.js";
import { extractVideo } from "../extractors/registry.js";

const BASE = "https://moflix-stream.xyz/";

interface MStreamTitle {
  id: number;
  name: string;
  tmdb_id?: number;
}

interface MStreamSearch {
  data?: MStreamTitle[];
}

export const mStreamProvider: ContentProvider = {
  id: "m-stream",
  name: "MoflixStream",
  language: "de",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(tmdbId, type, meta) {
    const res = await fetchJson<MStreamSearch>(
      `${BASE}api/v1/search/${encodeURIComponent(meta.title)}?limit=20`,
      { referer: BASE, mode: "json" }
    );
    const want = parseInt(tmdbId, 10);
    const match =
      res.data?.find((t) => t.tmdb_id === want) ??
      res.data?.find((t) => t.name.toLowerCase().includes(meta.title.toLowerCase().slice(0, 6)));
    if (!match) return null;
    return {
      providerId: "m-stream",
      contentId: String(match.id),
      title: match.name,
    };
  },
  async getServers(match, type, season = "1", episode = "1") {
    const path =
      type === "movie"
        ? `${BASE}api/v1/titles/${match.contentId}`
        : `${BASE}api/v1/titles/${match.contentId}/seasons/${season}/episodes/${episode}`;
    const json = await fetchJson<{ alternative_videos?: Array<{ id: string; src?: string; name?: string; playback_resolve_url?: string }> }>(
      path,
      { referer: BASE, mode: "json" }
    );
    return (json.alternative_videos ?? [])
      .filter((v) => v.src || v.playback_resolve_url)
      .map((v, i) => ({
        id: v.id ?? String(i),
        name: v.name ?? `Server ${i + 1}`,
        src: v.src || `${BASE}api/v1/${v.playback_resolve_url}`,
      }));
  },
  async getVideo(server): Promise<ExtractedVideo> {
    return extractVideo(server.src, server.name);
  },
};
