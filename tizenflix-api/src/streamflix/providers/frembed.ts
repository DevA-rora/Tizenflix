import type { ContentProvider } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { buildFrembedEntries } from "../extractors/frembed.js";
import { extractVideo } from "../extractors/registry.js";

/** Ported from Streamflix FrembedProvider — TMDB-id API links for French content. */
export const frembedProvider: ContentProvider = {
  id: "frembed",
  name: "Frembed",
  language: "fr",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(tmdbId, _type, meta) {
    return {
      providerId: "frembed",
      contentId: tmdbId,
      title: meta.title,
    };
  },
  async getServers(match, type, season = "1", episode = "1") {
    const entries = await buildFrembedEntries({
      type,
      tmdbId: match.contentId,
      season,
      episode,
    });
    return entries.map((e, i) => ({
      id: String(i),
      name: e.name,
      src: e.url,
    }));
  },
  async getVideo(server: StreamServer): Promise<ExtractedVideo> {
    return extractVideo(server.src, server.name);
  },
};
