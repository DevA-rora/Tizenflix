import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from AnimeUnityProvider — fill in TMDB/search logic. */
export const animeUnityProvider: ContentProvider = {
  id: "anime-unity",
  name: "AnimeUnity",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("AnimeUnity"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
