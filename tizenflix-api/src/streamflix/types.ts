export interface ExtractedSubtitle {
  label: string;
  file: string;
  default?: boolean;
}

export interface ExtractedVideo {
  source: string;
  subtitles: ExtractedSubtitle[];
  headers?: Record<string, string>;
  type?: string;
  audioLanguage?: string;
  audioVariant?: "original" | "dubbed" | "unknown";
  /** Max RESOLUTION= height parsed from the master playlist when known */
  manifestMaxHeight?: number;
}

export interface StreamServer {
  id: string;
  name: string;
  src: string;
  meta?: Record<string, string>;
}

export interface ExtractorDef {
  name: string;
  mainUrl: string;
  aliasUrls?: string[];
  rotatingDomain?: RegExp[];
  extract: (link: string, serverName?: string) => Promise<ExtractedVideo>;
}

export interface StreamflixResolveInput {
  type: "movie" | "tv";
  tmdbId: string;
  season?: string;
  episode?: string;
  title?: string;
}
