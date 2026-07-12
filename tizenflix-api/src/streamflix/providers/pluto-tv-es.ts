import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PlutoTvEsProvider — fill in TMDB/search logic. */
export const plutoTvEsProvider: ContentProvider = {
  id: "pluto-tv-es",
  name: "PlutoTvEs",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("PlutoTvEs"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
