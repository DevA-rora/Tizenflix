import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from FrenchMangaProvider — fill in TMDB/search logic. */
export const frenchMangaProvider: ContentProvider = {
  id: "french-manga",
  name: "FrenchManga",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("FrenchManga"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
