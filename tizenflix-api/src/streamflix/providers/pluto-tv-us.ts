import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PlutoTvUsProvider — fill in TMDB/search logic. */
export const plutoTvUsProvider: ContentProvider = {
  id: "pluto-tv-us",
  name: "PlutoTvUs",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("PlutoTvUs"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
