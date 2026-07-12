import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from LaCartoonsProvider — fill in TMDB/search logic. */
export const laCartoonsProvider: ContentProvider = {
  id: "la-cartoons",
  name: "LaCartoons",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("LaCartoons"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
