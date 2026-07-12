import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import {
  superStreamFindByTmdb,
  superStreamGetServers,
} from "./superstream.js";

export const superStreamProvider: ContentProvider = {
  id: "superstream",
  name: "SuperStream",
  language: "en",
  supportsMovies: true,
  supportsTv: true,
  enabled: true,
  implementationStatus: "full",
  async findByTmdb(tmdbId, type, meta) {
    const found = await superStreamFindByTmdb(tmdbId, type, meta.title);
    if (!found) return null;
    return {
      providerId: "superstream",
      contentId: found.id,
      title: found.title,
    };
  },
  async getServers(match, type, season = "1", episode = "1") {
    const direct = await superStreamGetServers(
      match.contentId,
      type,
      season,
      episode
    );
    return direct.map((s, i) => ({
      id: String(i),
      name: s.name,
      src: s.src,
      meta: { subtitles: JSON.stringify(s.subtitles) },
    }));
  },
  async getVideo(server: StreamServer): Promise<ExtractedVideo> {
    let subtitles: ExtractedVideo["subtitles"] = [];
    const raw = (server as StreamServer & { meta?: Record<string, string> }).meta?.subtitles;
    if (raw) {
      try {
        subtitles = JSON.parse(raw) as ExtractedVideo["subtitles"];
      } catch {
        subtitles = [];
      }
    }
    return {
      source: server.src,
      subtitles,
      headers: { Platform: "android" },
      type: "m3u8",
    };
  },
};
