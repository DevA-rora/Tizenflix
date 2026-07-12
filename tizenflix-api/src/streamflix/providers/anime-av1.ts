import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from AnimeAv1Provider — fill in TMDB/search logic. */
export const animeAv1Provider: ContentProvider = {
  id: "anime-av1",
  name: "AnimeAv1",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("AnimeAv1"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
