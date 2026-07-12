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
  type: "mp4" | "m3u8" | "unknown";
  url: string;
  priority: number;
}

export interface PlayResponse {
  title?: string;
  type: MediaType;
  tmdbId: string;
  season?: string;
  episode?: string;
  sources: PlayableSource[];
  recommended: string | null;
  subtitles: Array<{
    id: string;
    language: string;
    label: string;
    url: string;
    default?: boolean;
  }>;
  nextEpisode: null | { season: string; episode: string };
}

export interface ResolveOptions {
  type: MediaType;
  tmdbId: string;
  season?: string;
  episode?: string;
  server?: string;
  allServers?: boolean;
  firstSuccessOnly?: boolean;
}

export interface ServerResult {
  server: string;
  data: DecryptedSourceResponse | null;
  error?: string;
}
