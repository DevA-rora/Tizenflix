import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PlutoTvItProvider — fill in TMDB/search logic. */
export const plutoTvItProvider: ContentProvider = {
  id: "pluto-tv-it",
  name: "PlutoTvIt",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("PlutoTvIt"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
