import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from FrembedProvider — fill in TMDB/search logic. */
export const frembedProvider: ContentProvider = {
  id: "frembed",
  name: "Frembed",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("Frembed"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
