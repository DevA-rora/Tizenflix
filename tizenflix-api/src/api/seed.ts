import { API_BASE } from "../constants/servers.js";
import { VIDKING_HEADERS } from "../constants/headers.js";

const SEED_CACHE = new Map<string, { seed: string; expiresAt: number }>();
const CACHE_SKEW_MS = 5000;

interface SeedResponse {
  seed: string;
  ttlMs?: number;
}

/** Of() — fetch and cache decryption seed */
export async function fetchSeed(
  tmdbId: string,
  apiBase: string = API_BASE,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const origin = new URL(apiBase).origin;
  const key = `${origin}|${tmdbId}`;
  const now = Date.now();
  const cached = SEED_CACHE.get(key);
  if (cached && cached.expiresAt - CACHE_SKEW_MS > now) {
    return cached.seed;
  }

  const res = await fetchImpl(
    `${origin}/seed?mediaId=${encodeURIComponent(String(tmdbId))}`,
    { headers: VIDKING_HEADERS }
  );
  if (!res.ok) {
    throw new Error(`seed request failed: ${res.status}`);
  }

  const data = (await res.json()) as SeedResponse;
  SEED_CACHE.set(key, {
    seed: data.seed,
    expiresAt: now + (data.ttlMs ?? 30000),
  });
  return data.seed;
}

/** Lf() — bust seed cache (on 401) */
export function clearSeedCache(
  tmdbId: string,
  apiBase: string = API_BASE
): void {
  const origin = new URL(apiBase).origin;
  SEED_CACHE.delete(`${origin}|${tmdbId}`);
}

export function clearAllSeedCache(): void {
  SEED_CACHE.clear();
}
