import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PlutoTvFrProvider — fill in TMDB/search logic. */
export const plutoTvFrProvider: ContentProvider = {
  id: "pluto-tv-fr",
  name: "PlutoTvFr",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("PlutoTvFr"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
