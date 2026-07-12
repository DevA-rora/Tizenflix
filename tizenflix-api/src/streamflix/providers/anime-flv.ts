import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from AnimeFlvProvider — fill in TMDB/search logic. */
export const animeFlvProvider: ContentProvider = {
  id: "anime-flv",
  name: "AnimeFlv",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("AnimeFlv"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
