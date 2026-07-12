import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from IptvSpainProvider — fill in TMDB/search logic. */
export const iptvSpainProvider: ContentProvider = {
  id: "iptv-spain",
  name: "IptvSpain",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("IptvSpain"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
