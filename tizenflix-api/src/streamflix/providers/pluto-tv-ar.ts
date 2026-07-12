import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PlutoTvArProvider — fill in TMDB/search logic. */
export const plutoTvArProvider: ContentProvider = {
  id: "pluto-tv-ar",
  name: "PlutoTvAr",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("PlutoTvAr"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
