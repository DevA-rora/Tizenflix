import type { ContentProvider } from "./types.js";
import type { ExtractedVideo } from "../types.js";
import { buildMoflixEntries } from "../extractors/moflix.js";
import { extractVideo } from "../extractors/registry.js";

/** MoflixStream scraper — uses Moflix API (ported from Streamflix MStreamProvider). */
export const mStreamProvider: ContentProvider = {
  id: "m-stream",
  name: "MoflixStream",
  language: "de",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(tmdbId, _type, meta) {
    return {
      providerId: "m-stream",
      contentId: tmdbId,
      title: meta.title,
    };
  },
  async getServers(match, type, season = "1", episode = "1") {
    const entries = await buildMoflixEntries({
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
  async getVideo(server): Promise<ExtractedVideo> {
    return extractVideo(server.src, server.name);
  },
};
