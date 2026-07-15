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
  genres?: string[];
  genreIds?: number[];
  originalLanguage?: string;
}

export interface PlayableSource {
  id: string;
  provider: string;
  label: string;
  type: "mp4" | "m3u8" | "dash" | "unknown";
  url: string;
  priority: number;
  /** TMDB-native source id (vixsrc, vidrock, …) for player source picker */
  sourceId?: string;
  /** Streamflix scraper provider registry id (sflix, ridomovies, …) */
  providerId?: string;
  /** Per-source upstream headers for Streamflix embed hosts */
  upstreamHeaders?: Record<string, string>;
  /** ISO-ish audio track language when known (en, ja, fr, …) */
  audioLanguage?: string;
  /** Original voice acting vs dub when known */
  audioVariant?: "original" | "dubbed" | "unknown";
}

export interface PlayResponse {
  title?: string;
  imdbId?: string;
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
  backend?: "videasy" | "vidking" | "streamflix" | "tmdb-native" | "auto";
  resolveMs?: number;
  audioPreference?: {
    mode: "original" | "specific";
    targetLanguage: string;
  };
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

export type PlayBackend = "videasy" | "vidking" | "streamflix" | "tmdb-native" | "auto";

/** WingsDatabase CDN player identity (headers + server map). */
export type CdnIdentity = "vidking" | "videasy";

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
  /** Which WingsDatabase player identity to use (defaults from backend). */
  cdnIdentity?: CdnIdentity;
  onlySourceId?: string;
  onlySourceIds?: string[];
  /** Override auto TMDB-native source list (comma-separated ids in query) */
  sources?: string[];
  onePerSource?: boolean;
  mergeOrder?: string[];
  sourceTimeoutMs?: number;
  /** Catalog / resolve language (e.g. en, de, fr) */
  lang?: string;
  /** Audio / dubbing preference: original or ISO code (e.g. ja, en) */
  audioLang?: string;
  /** Resolved target audio language for extractors and proxy */
  targetAudioLang?: string;
  /** Resolve a single Streamflix scraper provider only */
  providerId?: string;
  /** Hint: try this provider first in ordered streamflix resolve */
  preferredProviderId?: string;
  /** Race all streamflix providers in parallel (benchmark / ?race=1) */
  raceProviders?: boolean;
  /** Content is anime (used for provider ordering) */
  isAnime?: boolean;
  /** Single-provider-first resolve for backend=auto step 1 */
  autoMode?: boolean;
  /** Client-requested max video height (e.g. 1080, 2160) */
  maxHeight?: number;
}

export interface ServerResult {
  server: string;
  data: DecryptedSourceResponse | null;
  error?: string;
}
