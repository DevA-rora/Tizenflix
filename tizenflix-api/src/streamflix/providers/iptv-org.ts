import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from IptvOrgProvider — fill in TMDB/search logic. */
export const iptvOrgProvider: ContentProvider = {
  id: "iptv-org",
  name: "IptvOrg",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("IptvOrg"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
