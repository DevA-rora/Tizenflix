import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PlutoTvDeProvider — fill in TMDB/search logic. */
export const plutoTvDeProvider: ContentProvider = {
  id: "pluto-tv-de",
  name: "PlutoTvDe",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("PlutoTvDe"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
