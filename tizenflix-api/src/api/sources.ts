import {
  API_BASE,
  ENCRYPTION_VERSION,
  getServerByName,
  type ServerConfig,
} from "../constants/servers.js";
import { getVideasyServerByName } from "../constants/videasy-servers.js";
import { NO_CACHE_HEADERS, VIDEASY_NO_CACHE_HEADERS } from "../constants/headers.js";
import { fetchWithTimeout } from "../fetch-timeout.js";
import { decryptAndParse } from "../crypto/decrypt.js";
import { clearSeedCache, fetchSeed } from "./seed.js";
import type {
  CdnIdentity,
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

export interface SourceFetchOptions {
  identity?: CdnIdentity;
}

const UPSTREAM_TIMEOUT_MS = 12_000;

function headersForIdentity(identity: CdnIdentity): HeadersInit {
  return identity === "videasy" ? VIDEASY_NO_CACHE_HEADERS : NO_CACHE_HEADERS;
}

function resolveServer(
  serverName: string,
  identity: CdnIdentity
): ServerConfig | undefined {
  if (identity === "videasy") {
    return getVideasyServerByName(serverName);
  }
  return getServerByName(serverName);
}

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

/** Prefer HLS manifests for Tizen playback (DASH is not supported in the TV app yet). */
export function preferHlsSources(
  data: DecryptedSourceResponse
): DecryptedSourceResponse {
  if (!data?.sources || !Array.isArray(data.sources)) return data;
  const hls = data.sources.filter((s) => {
    const url = s?.url?.toLowerCase?.() ?? "";
    return s?.type === "hls" || url.includes(".m3u8") || url.includes("m3u8");
  });
  if (hls.length === 0) return data;
  return { ...data, sources: hls };
}

async function fetchEncryptedOnce(
  url: string,
  fetchImpl: typeof fetch,
  identity: CdnIdentity
): Promise<string> {
  const res = await fetchWithTimeout(
    url,
    { headers: headersForIdentity(identity) },
    UPSTREAM_TIMEOUT_MS,
    fetchImpl
  );
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
  fetchImpl: typeof fetch = fetch,
  opts: SourceFetchOptions = {}
): Promise<DecryptedSourceResponse> {
  const identity = opts.identity ?? "vidking";
  const server = resolveServer(serverName, identity);
  if (!server || !server.isActive) {
    throw new Error(`Server "${serverName}" is not available or does not exist`);
  }

  const tmdbNum = parseInt(req.tmdbId, 10);

  const attempt = async (): Promise<DecryptedSourceResponse> => {
    const seed = await fetchSeed(req.tmdbId, API_BASE, fetchImpl, identity);
    const url = buildSourceUrl(server.endpoint, seed, {
      ...req,
      seed,
      timestamp: req.timestamp ?? String(Date.now()),
    });
    const ciphertext = await fetchEncryptedOnce(url, fetchImpl, identity);
    const parsed = decryptAndParse<DecryptedSourceResponse>(
      ciphertext,
      seed,
      tmdbNum
    );
    return preferHlsSources(parsed);
  };

  try {
    return await attempt();
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status === 401) {
      clearSeedCache(req.tmdbId, API_BASE, identity);
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
  fetchImpl: typeof fetch = fetch,
  opts: SourceFetchOptions = {}
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
      fetchImpl,
      opts
    );
    if (!data?.sources?.length) return null;
    return data;
  } catch {
    return null;
  }
}
