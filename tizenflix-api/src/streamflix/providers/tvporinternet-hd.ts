import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from TvporinternetHDProvider — fill in TMDB/search logic. */
export const tvporinternetHdProvider: ContentProvider = {
  id: "tvporinternet-hd",
  name: "TvporinternetHD",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("TvporinternetHD"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
