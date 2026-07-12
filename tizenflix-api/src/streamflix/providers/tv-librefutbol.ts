import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from TvLibrefutbolProvider — fill in TMDB/search logic. */
export const tvLibrefutbolProvider: ContentProvider = {
  id: "tv-librefutbol",
  name: "TvLibrefutbol",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("TvLibrefutbol"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
