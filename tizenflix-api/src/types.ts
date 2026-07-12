export type MediaType = "movie" | "tv";

export interface StreamSource {
  url: string;
  quality?: string;
  type?: string;
}

export interface SubtitleTrack {
  url?: string;
  language?: string;
  label?: string;
  file?: string;
  [key: string]: unknown;
}

export interface DecryptedSourceResponse {
  sources?: StreamSource[];
  subtitles?: SubtitleTrack[];
  mediaType?: string;
  tmdbId?: string;
  [key: string]: unknown;
}

export interface Metadata {
  title: string;
  year: string | number;
  imdbId: string;
}

export interface PlayableSource {
  id: string;
  provider: string;
  label: string;
  type: "mp4" | "m3u8" | "dash" | "unknown";
  url: string;
  priority: number;
  /** Per-source upstream headers for Streamflix embed hosts */
  upstreamHeaders?: Record<string, string>;
}

export interface PlayResponse {
  title?: string;
  type: MediaType;
  tmdbId: string;
  season?: string;
  episode?: string;
  sources: PlayableSource[];
  recommended: string | null;
  warnings?: string[];
  subtitles: Array<{
    id: string;
    language: string;
    label: string;
    url: string;
    default?: boolean;
  }>;
  nextEpisode: null | { season: string; episode: string };
  backend?: "vidking" | "streamflix" | "tmdb-native" | "auto";
  resolveMs?: number;
  onlySourceId?: string;
  sourceResults?: Array<{
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
  }>;
  providerResults?: Array<{
    provider: string;
    providerId: string;
    ok: boolean;
    ms: number;
    servers: number;
    hls: number;
    subtitles: number;
    cfBypassUsed?: boolean;
    error?: string;
    layer?: "infra" | "network" | "provider" | "extractor";
  }>;
}

export type PlayBackend = "vidking" | "streamflix" | "tmdb-native" | "auto";

export interface ResolveOptions {
  type: MediaType;
  tmdbId: string;
  season?: string;
  episode?: string;
  server?: string;
  allServers?: boolean;
  firstSuccessOnly?: boolean;
  profile?: "tizen" | "default";
  providerScore?: (provider: string) => number;
  backend?: PlayBackend;
  onlySourceId?: string;
}

export interface ServerResult {
  server: string;
  data: DecryptedSourceResponse | null;
  error?: string;
}
