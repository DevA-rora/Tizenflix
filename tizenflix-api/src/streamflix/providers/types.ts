import type { ExtractedVideo, StreamServer } from "../types.js";

export interface ProviderMatch {
  providerId: string;
  contentId: string;
  title: string;
  slug?: string;
  meta?: Record<string, string>;
}

export interface ContentProvider {
  id: string;
  name: string;
  language: string;
  supportsMovies: boolean;
  supportsTv: boolean;
  enabled?: boolean;
  implementationStatus?: "full" | "partial" | "stub";
  requiresPlaywright?: boolean;
  findByTmdb(
    tmdbId: string,
    type: "movie" | "tv",
    meta: { title: string }
  ): Promise<ProviderMatch | null>;
  getServers(
    match: ProviderMatch,
    type: "movie" | "tv",
    season?: string,
    episode?: string
  ): Promise<StreamServer[]>;
  getVideo(server: StreamServer): Promise<ExtractedVideo>;
}
