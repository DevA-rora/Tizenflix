import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PlutoTvMxProvider — fill in TMDB/search logic. */
export const plutoTvMxProvider: ContentProvider = {
  id: "pluto-tv-mx",
  name: "PlutoTvMx",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("PlutoTvMx"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
