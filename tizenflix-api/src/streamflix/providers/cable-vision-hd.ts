import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from CableVisionHDProvider — fill in TMDB/search logic. */
export const cableVisionHdProvider: ContentProvider = {
  id: "cable-vision-hd",
  name: "CableVisionHD",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("CableVisionHD"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
