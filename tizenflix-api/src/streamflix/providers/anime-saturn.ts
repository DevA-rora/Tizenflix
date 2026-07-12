import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from AnimeSaturnProvider — fill in TMDB/search logic. */
export const animeSaturnProvider: ContentProvider = {
  id: "anime-saturn",
  name: "AnimeSaturn",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("AnimeSaturn"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
