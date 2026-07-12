import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from PelisplustoProvider — fill in TMDB/search logic. */
export const pelisplustoProvider: ContentProvider = {
  id: "pelisplusto",
  name: "Pelisplusto",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("Pelisplusto"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
