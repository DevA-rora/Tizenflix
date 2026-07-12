import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from LatanimeProvider — fill in TMDB/search logic. */
export const latanimeProvider: ContentProvider = {
  id: "latanime",
  name: "Latanime",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("Latanime"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
