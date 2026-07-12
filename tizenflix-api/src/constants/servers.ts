/** Vidking player bundle these constants were extracted from. */
export const PLAYER_BUNDLE = "VideoPlayer-CfmbsjlB.js";

export const API_BASE = "https://api.wingsdatabase.com";
export const METADATA_BASE = "https://db.wingsdatabase.com/3";
export const SUBTITLES_BASE = "https://subs.videasy.to";

export const ENCRYPTION_VERSION = "2";

export interface ServerConfig {
  name: string;
  endpoint: string;
  isActive: boolean;
}

/** Ti map from VideoPlayer-CfmbsjlB.js */
export const SERVERS: Record<string, ServerConfig> = {
  HYDROGEN: {
    name: "Hydrogen",
    endpoint: "cdn/sources-with-title",
    isActive: true,
  },
  TITANIUM: {
    name: "Titanium",
    endpoint: "tejo/sources-with-title",
    isActive: true,
  },
  OXYGEN: {
    name: "Oxygen",
    endpoint: "neon2/sources-with-title",
    isActive: true,
  },
  LITHIUM: {
    name: "Lithium",
    endpoint: "downloader2/sources-with-title",
    isActive: true,
  },
  HELIUM: {
    name: "Helium",
    endpoint: "1movies/sources-with-title",
    isActive: true,
  },
};

/** Es — server try order from player JS */
export const SERVER_PRIORITY = [
  SERVERS.HYDROGEN.name,
  SERVERS.TITANIUM.name,
  SERVERS.OXYGEN.name,
  SERVERS.LITHIUM.name,
  SERVERS.HELIUM.name,
];

/** TV-friendly order — Oxygen/Titanium HLS first; Lithium often MP4-only */
export const TIZEN_SERVER_PRIORITY = [
  SERVERS.OXYGEN.name,
  SERVERS.TITANIUM.name,
  SERVERS.HELIUM.name,
  SERVERS.HYDROGEN.name,
  SERVERS.LITHIUM.name,
];

export function getServerByName(name: string): ServerConfig | undefined {
  const lower = name.toLowerCase();
  return Object.values(SERVERS).find((s) => s.name.toLowerCase() === lower);
}

export function getActiveServers(): ServerConfig[] {
  return Object.values(SERVERS).filter((s) => s.isActive);
}
