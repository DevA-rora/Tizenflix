import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from GuardaFlixProvider — fill in TMDB/search logic. */
export const guardaFlixProvider: ContentProvider = {
  id: "guarda-flix",
  name: "GuardaFlix",
  language: "en",
  supportsMovies: true,
  supportsTv: false,
  enabled: false,
  findByTmdb: stubFindByTmdb("GuardaFlix"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
