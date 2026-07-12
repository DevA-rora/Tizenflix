import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from CineCityProvider — fill in TMDB/search logic. */
export const cineCityProvider: ContentProvider = {
  id: "cine-city",
  name: "CineCity",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("CineCity"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
