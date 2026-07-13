import { resolvePlayableSources } from "../normalize/to-play-response.js";
import {
  autoTmdbSourceIdsForType,
  resolveTmdbNativeFromOptions,
  resolveTmdbNativeRaceFromOptions,
} from "../streamflix/tmdb-native/resolve.js";
import type { PlayResponse, ResolveOptions } from "../types.js";

const TIER1_TIMEOUT_MS = 4_000;
const TIER2_TIMEOUT_MS = 8_000;

function tagBackend(play: PlayResponse, backend: PlayResponse["backend"], ms: number): PlayResponse {
  return { ...play, backend, resolveMs: ms };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

function hasPlayableSources(play: PlayResponse | null): play is PlayResponse {
  return Boolean(play?.sources?.length);
}

async function resolveAutoTiered(
  options: ResolveOptions,
  fetchImpl: typeof fetch
): Promise<PlayResponse> {
  const autoIds = options.onlySourceIds ?? options.sources ?? autoTmdbSourceIdsForType(options.type);

  // Tier 1: VixSrc only (fast path)
  try {
    const { result, ms } = await timed(() =>
      resolveTmdbNativeFromOptions(
        {
          ...options,
          onlySourceIds: ["vixsrc"],
          onePerSource: true,
          sourceTimeoutMs: TIER1_TIMEOUT_MS,
        },
        fetchImpl
      )
    );
    if (hasPlayableSources(result)) {
      return tagBackend({ ...result, backend: "auto" }, "auto", ms);
    }
  } catch {
    /* Tier 2 */
  }

  // Tier 2: remaining TMDB-native sources (race)
  const tier2Ids = autoIds.filter((id) => id !== "vixsrc");
  if (tier2Ids.length) {
    try {
      const { result, ms } = await timed(() =>
        resolveTmdbNativeRaceFromOptions(options, tier2Ids, TIER2_TIMEOUT_MS, fetchImpl)
      );
      if (hasPlayableSources(result)) {
        return tagBackend({ ...result, backend: "auto" }, "auto", ms);
      }
    } catch {
      /* Tier 3 */
    }
  }

  // Tier 3: Vidking first-success
  const { result, ms } = await timed(() =>
    resolvePlayableSources(
      {
        ...options,
        allServers: false,
        firstSuccessOnly: true,
      },
      fetchImpl
    )
  );
  return tagBackend({ ...result, backend: "auto" }, "auto", ms);
}

export async function resolveWithBackend(
  options: ResolveOptions,
  fetchImpl: typeof fetch = fetch
): Promise<PlayResponse> {
  const backend = options.backend ?? "auto";

  if (backend === "vidking") {
    const { result, ms } = await timed(() => resolvePlayableSources(options, fetchImpl));
    return tagBackend(result, "vidking", ms);
  }

  if (backend === "tmdb-native") {
    const { result, ms } = await timed(() =>
      resolveTmdbNativeFromOptions(options, fetchImpl)
    );
    return tagBackend(result, "tmdb-native", ms);
  }

  if (backend === "streamflix") {
    const { resolveStreamflixFromOptions } = await import("../streamflix/resolve.js");
    const { result, ms } = await timed(() =>
      resolveStreamflixFromOptions(options, fetchImpl)
    );
    return tagBackend(result, "streamflix", ms);
  }

  if (options.onlySourceId || options.onlySourceIds?.length) {
    const { result, ms } = await timed(() =>
      resolveTmdbNativeFromOptions(
        {
          ...options,
          onePerSource: true,
          mergeOrder: options.onlySourceIds ?? (options.onlySourceId ? [options.onlySourceId] : undefined),
        },
        fetchImpl
      )
    );
    return tagBackend({ ...result, backend: "auto" }, "auto", ms);
  }

  return resolveAutoTiered(options, fetchImpl);
}

export function parseBackendParam(raw: unknown): ResolveOptions["backend"] {
  if (
    raw === "streamflix" ||
    raw === "auto" ||
    raw === "vidking" ||
    raw === "tmdb-native"
  ) {
    return raw;
  }
  return "auto";
}

export function parseSourcesParam(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
