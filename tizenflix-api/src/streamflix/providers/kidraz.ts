import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from KidrazProvider — fill in TMDB/search logic. */
export const kidrazProvider: ContentProvider = {
  id: "kidraz",
  name: "Kidraz",
  language: "en",
  supportsMovies: true,
  supportsTv: false,
  enabled: false,
  findByTmdb: stubFindByTmdb("Kidraz"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
