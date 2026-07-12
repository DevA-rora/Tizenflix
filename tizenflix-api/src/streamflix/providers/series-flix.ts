import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from SeriesFlixProvider — fill in TMDB/search logic. */
export const seriesFlixProvider: ContentProvider = {
  id: "series-flix",
  name: "SeriesFlix",
  language: "en",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("SeriesFlix"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
