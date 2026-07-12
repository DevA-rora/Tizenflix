import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from AnimefenixProvider — fill in TMDB/search logic. */
export const animefenixProvider: ContentProvider = {
  id: "animefenix",
  name: "Animefenix",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("Animefenix"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
