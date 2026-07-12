import type { ExtractedVideo } from "../types.js";

export interface TmdbNativeResolveOpts {
  type: "movie" | "tv";
  tmdbId: string;
  season?: string;
  episode?: string;
  title: string;
  year?: string | number;
  imdbId?: string;
  lang?: string;
}

export interface TmdbNativeEntry {
  name: string;
  url: string;
}

export interface TmdbNativeSource {
  id: string;
  name: string;
  mainUrl: string;
  supportsMovies: boolean;
  supportsTv: boolean;
  priority: number;
  duplicateOf?: string;
  buildEntries(opts: TmdbNativeResolveOpts): TmdbNativeEntry[] | Promise<TmdbNativeEntry[]>;
}

export interface TmdbNativeSourceResult {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  ms: number;
  servers: number;
  hls: number;
  subtitles: number;
  cfBypassUsed?: boolean;
  error?: string;
  layer?: "preflight" | "api_hop" | "extract" | "network" | "infra";
  duplicateOf?: string;
  entries?: Array<{ serverName: string; sourceName: string; url: string; type: string }>;
  resolved?: Array<{ serverName: string; sourceName: string; video: ExtractedVideo }>;
}
