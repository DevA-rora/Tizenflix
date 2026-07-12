import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from VavooProvider — fill in TMDB/search logic. */
export const vavooDeProvider: ContentProvider = {
  id: "vavoo-de",
  name: "Vavoo",
  language: "de",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("Vavoo"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
