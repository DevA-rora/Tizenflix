import {
  API_BASE,
  ENCRYPTION_VERSION,
  getServerByName,
} from "../constants/servers.js";
import { NO_CACHE_HEADERS } from "../constants/headers.js";
import { decryptAndParse } from "../crypto/decrypt.js";
import { clearSeedCache, fetchSeed } from "./seed.js";
import type {
  DecryptedSourceResponse,
  MediaType,
  Metadata,
} from "../types.js";

export interface SourceRequest {
  mediaType: MediaType;
  tmdbId: string;
  seasonId?: string;
  episodeId?: string;
  title: string;
  year: string | number;
  imdbId: string;
  seed?: string;
  timestamp?: string;
}

const DEFAULT_HEADERS = NO_CACHE_HEADERS;

function buildSourceUrl(
  endpoint: string,
  seed: string,
  req: SourceRequest
): string {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set("title", req.title);
  url.searchParams.set("mediaType", req.mediaType);
  url.searchParams.set("year", String(req.year));
  url.searchParams.set("episodeId", req.episodeId ?? "1");
  url.searchParams.set("seasonId", req.seasonId ?? "1");
  url.searchParams.set("tmdbId", req.tmdbId);
  url.searchParams.set("imdbId", req.imdbId ?? "");
  url.searchParams.set("enc", ENCRYPTION_VERSION);
  url.searchParams.set("seed", seed);
  if (req.timestamp) {
    url.searchParams.set("_t", req.timestamp);
  }
  return url.toString();
}

/** Prefer DASH/MPD when present (sl() in player JS). */
export function preferDashSources(
  data: DecryptedSourceResponse
): DecryptedSourceResponse {
  if (!data?.sources || !Array.isArray(data.sources)) return data;
  const dash = data.sources.filter(
    (s) =>
      s?.type === "dash" ||
      s?.url?.toLowerCase?.().includes(".mpd")
  );
  if (dash.length === 0) return data;
  return { ...data, sources: dash };
}

async function fetchEncryptedOnce(
  url: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const res = await fetchImpl(url, { headers: DEFAULT_HEADERS });
  if (res.status === 401) {
    const err = new Error("seed rejected") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Source API request failed: ${res.status}`);
  }
  return res.text();
}

/** ha() — fetch + decrypt sources for one named server */
export async function fetchServerSources(
  serverName: string,
  req: Omit<SourceRequest, "seed">,
  fetchImpl: typeof fetch = fetch
): Promise<DecryptedSourceResponse> {
  const server = getServerByName(serverName);
  if (!server || !server.isActive) {
    throw new Error(`Server "${serverName}" is not available or does not exist`);
  }

  const tmdbNum = parseInt(req.tmdbId, 10);

  const attempt = async (): Promise<DecryptedSourceResponse> => {
    const seed = await fetchSeed(req.tmdbId, API_BASE, fetchImpl);
    const url = buildSourceUrl(server.endpoint, seed, {
      ...req,
      seed,
      timestamp: req.timestamp ?? String(Date.now()),
    });
    const ciphertext = await fetchEncryptedOnce(url, fetchImpl);
    const parsed = decryptAndParse<DecryptedSourceResponse>(
      ciphertext,
      seed,
      tmdbNum
    );
    return preferDashSources(parsed);
  };

  try {
    return await attempt();
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status === 401) {
      clearSeedCache(req.tmdbId);
      return attempt();
    }
    throw err;
  }
}

/** al() — direct single-server fetch with metadata */
export async function fetchServerSourcesDirect(
  serverName: string,
  mediaType: MediaType,
  tmdbId: string,
  meta: Metadata,
  seasonId?: string,
  episodeId?: string,
  fetchImpl: typeof fetch = fetch
): Promise<DecryptedSourceResponse | null> {
  try {
    const data = await fetchServerSources(
      serverName,
      {
        mediaType,
        tmdbId,
        seasonId: seasonId ?? "1",
        episodeId: episodeId ?? "1",
        title: meta.title,
        year: meta.year,
        imdbId: meta.imdbId,
        timestamp: String(Date.now()),
      },
      fetchImpl
    );
    if (!data?.sources?.length) return null;
    return data;
  } catch {
    return null;
  }
}
