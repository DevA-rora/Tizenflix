import type { ContentProvider } from "./types.js";
import { stubFindByTmdb, stubGetServers, stubGetVideo } from "./base.js";

export const vavooItProvider: ContentProvider = {
  id: "vavoo-it",
  name: "Vavoo IT",
  language: "it",
  supportsMovies: false,
  supportsTv: true,
  enabled: false,
  findByTmdb: stubFindByTmdb("Vavoo IT"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
