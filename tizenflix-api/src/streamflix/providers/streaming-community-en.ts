import { fetchJson } from "../http.js";
import { extractVideo } from "../extractors/registry.js";
import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";

const DOMAIN = "streamingunity.dog";
const BASE = `https://${DOMAIN}/`;

interface SearchResult {
  id: string;
  name: string;
  type: string;
  tmdb_id?: number;
  slug: string;
}

interface SearchResponse {
  data: SearchResult[];
}

export const streamingCommunityEnProvider: ContentProvider = {
  id: "streaming-community-en",
  name: "StreamingCommunity (EN)",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(tmdbId, type, meta) {
    const res = await fetchJson<SearchResponse>(
      `${BASE}search?q=${encodeURIComponent(meta.title)}&page=1&lang=en`,
      {
        headers: { Accept: "application/json", Referer: BASE, Origin: BASE },
      }
    );
    const want = type === "movie" ? "movie" : "tv";
    const match =
      res.data?.find((d) => d.tmdb_id === parseInt(tmdbId, 10) && d.type === want) ??
      res.data?.find((d) => d.type === want);
    if (!match) return null;
    return {
      providerId: "streaming-community-en",
      contentId: match.id,
      title: match.name,
      slug: match.slug,
    };
  },
  async getServers(match, type, season = "1", episode = "1") {
    const path =
      type === "movie"
        ? `${BASE}api/series/${match.slug}`
        : `${BASE}api/series/${match.slug}/seasons/${season}/episodes/${episode}`;
    const detail = await fetchJson<{ data?: { embed?: string; player?: string } }>(path, {
      headers: { Accept: "application/json", Referer: BASE },
    });
    const embed = detail.data?.embed ?? detail.data?.player;
    if (!embed) throw new Error("StreamingCommunity: no embed URL");
    return [{ id: "1", name: "Vixcloud", src: embed }];
  },
  async getVideo(server: StreamServer): Promise<ExtractedVideo> {
    return extractVideo(server.src, server.name);
  },
};
