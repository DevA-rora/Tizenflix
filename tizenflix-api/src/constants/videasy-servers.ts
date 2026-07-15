import type { ServerConfig } from "./servers.js";

/** Videasy player identity — WingsDatabase CDN with player.videasy.to Origin. */
export const VIDEASY_PLAYER_ORIGIN = "https://player.videasy.to";
export const VIDEASY_PLAYER_REFERER = "https://player.videasy.to/";

export interface VideasyServerConfig extends ServerConfig {
  /** Skip for TV resolves (cdn/Yoru is movie-oriented). */
  movieOnly?: boolean;
}

/**
 * Server map from EncDecEndpoints / Videasy player reverse-engineering.
 * Same WingsDatabase host as Vidking; different names and a wider endpoint set.
 */
export const VIDEASY_SERVERS: Record<string, VideasyServerConfig> = {
  NEON: {
    name: "Neon",
    endpoint: "neon2/sources-with-title",
    isActive: true,
  },
  TEJO: {
    name: "Tejo",
    endpoint: "tejo/sources-with-title",
    isActive: true,
  },
  YORU: {
    name: "Yoru",
    endpoint: "cdn/sources-with-title",
    isActive: true,
  },
  SAGE: {
    name: "Sage",
    endpoint: "ym/sources-with-title",
    isActive: true,
  },
  CYPHER: {
    name: "Cypher",
    endpoint: "downloader2/sources-with-title",
    isActive: true,
  },
  VYSE: {
    name: "Vyse",
    endpoint: "hdmovie/sources-with-title",
    isActive: true,
  },
  BREACH: {
    name: "Breach",
    endpoint: "m4uhd/sources-with-title",
    isActive: true,
  },
  JETT: {
    name: "Jett",
    endpoint: "jett/sources-with-title",
    isActive: true,
  },
  /** German language track server */
  KILLJOY: {
    name: "Killjoy",
    endpoint: "meine/sources-with-title",
    isActive: true,
  },
};

/** Default English try order — Neon/Tejo/Yoru tend to be HLS-friendly. */
export const VIDEASY_SERVER_PRIORITY = [
  VIDEASY_SERVERS.NEON.name,
  VIDEASY_SERVERS.TEJO.name,
  VIDEASY_SERVERS.YORU.name,
  VIDEASY_SERVERS.SAGE.name,
  VIDEASY_SERVERS.CYPHER.name,
  VIDEASY_SERVERS.VYSE.name,
  VIDEASY_SERVERS.BREACH.name,
  VIDEASY_SERVERS.JETT.name,
];

/** Tizen/TV: prefer Neon + Yoru HLS before MP4-heavy Cypher. */
export const VIDEASY_TIZEN_SERVER_PRIORITY = [
  VIDEASY_SERVERS.NEON.name,
  VIDEASY_SERVERS.YORU.name,
  VIDEASY_SERVERS.TEJO.name,
  VIDEASY_SERVERS.SAGE.name,
  VIDEASY_SERVERS.CYPHER.name,
  VIDEASY_SERVERS.VYSE.name,
  VIDEASY_SERVERS.BREACH.name,
  VIDEASY_SERVERS.JETT.name,
];

export function getVideasyServerByName(name: string): VideasyServerConfig | undefined {
  const lower = name.toLowerCase();
  return Object.values(VIDEASY_SERVERS).find((s) => s.name.toLowerCase() === lower);
}

export function getActiveVideasyServers(opts?: {
  mediaType?: "movie" | "tv";
  lang?: string;
}): VideasyServerConfig[] {
  const mediaType = opts?.mediaType;
  const lang = (opts?.lang ?? "en").toLowerCase().split("-")[0];
  return Object.values(VIDEASY_SERVERS).filter((s) => {
    if (!s.isActive) return false;
    if (s.movieOnly && mediaType === "tv") return false;
    if (s.name === "Killjoy" && lang !== "de") return false;
    return true;
  });
}

export function videasyServerPriorityFor(opts?: {
  profile?: "tizen" | "default";
  mediaType?: "movie" | "tv";
  lang?: string;
}): string[] {
  const active = new Set(
    getActiveVideasyServers({ mediaType: opts?.mediaType, lang: opts?.lang }).map((s) => s.name)
  );
  // TV: Yoru/cdn is the reliable hit; Neon often 500s and burns the upstream timeout.
  const base =
    opts?.mediaType === "tv"
      ? [
          VIDEASY_SERVERS.YORU.name,
          VIDEASY_SERVERS.NEON.name,
          VIDEASY_SERVERS.TEJO.name,
          VIDEASY_SERVERS.SAGE.name,
          VIDEASY_SERVERS.CYPHER.name,
          VIDEASY_SERVERS.VYSE.name,
          VIDEASY_SERVERS.BREACH.name,
          VIDEASY_SERVERS.JETT.name,
        ]
      : opts?.profile === "tizen"
        ? VIDEASY_TIZEN_SERVER_PRIORITY
        : VIDEASY_SERVER_PRIORITY;
  const ordered = base.filter((n) => active.has(n));
  for (const name of active) {
    if (!ordered.includes(name)) ordered.push(name);
  }
  return ordered;
}
