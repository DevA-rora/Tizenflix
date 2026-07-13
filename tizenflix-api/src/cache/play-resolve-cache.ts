import type { PlayResponse } from "../types.js";

const TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  play: PlayResponse;
  expiresAt: number;
  validatedAt?: number;
}

const cache = new Map<string, CacheEntry>();

export interface PlayResolveCacheKeyInput {
  type: "movie" | "tv";
  tmdbId: string;
  season?: string;
  episode?: string;
  backend?: string;
  onlySourceId?: string;
  server?: string;
  /** Comma-separated TMDB-native source ids (e.g. twoembed,vidrock). */
  sources?: string;
  lang?: string;
  audioLang?: string;
}

export function playResolveCacheKey(input: PlayResolveCacheKeyInput): string {
  return [
    input.type,
    input.tmdbId,
    input.season ?? "",
    input.episode ?? "",
    input.backend ?? "auto",
    input.onlySourceId ?? "",
    input.server ?? "",
    input.sources ?? "",
    input.lang ?? "",
    input.audioLang ?? "",
  ].join(":");
}

export function getCachedPlay(key: string): PlayResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.play;
}

export function setCachedPlay(key: string, play: PlayResponse): void {
  cache.set(key, { play, expiresAt: Date.now() + TTL_MS });
}

export function isCachedPlayValidated(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return false;
  }
  return typeof entry.validatedAt === "number";
}

export function markCachedPlayValidated(key: string): void {
  const entry = cache.get(key);
  if (entry) entry.validatedAt = Date.now();
}

export function invalidatePlayCacheForTmdb(tmdbId: string): void {
  for (const key of cache.keys()) {
    if (key.includes(`:${tmdbId}:`) || key.endsWith(`:${tmdbId}:`)) {
      cache.delete(key);
    }
  }
}
