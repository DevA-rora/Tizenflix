import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PelotaLibreTvHdProvider — fill in TMDB/search logic. */
export const pelotaLibreTvHdProvider: ContentProvider = {
  id: "pelota-libre-tv-hd",
  name: "PelotaLibreTvHd",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("PelotaLibreTvHd"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
