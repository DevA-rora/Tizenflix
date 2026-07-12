import type { TmdbNativeSource } from "./types.js";

export interface PreflightResult {
  sourceId: string;
  sourceName: string;
  mainUrl: string;
  reachable: boolean;
  status: number | null;
  ms: number;
  error?: string;
}

export async function preflightSource(
  source: TmdbNativeSource,
  timeoutMs = 5_000
): Promise<PreflightResult> {
  const started = Date.now();
  const base: PreflightResult = {
    sourceId: source.id,
    sourceName: source.name,
    mainUrl: source.mainUrl,
    reachable: false,
    status: null,
    ms: 0,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(source.mainUrl, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tizenflix/1.0)" },
    }).catch(async () =>
      fetch(source.mainUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Tizenflix/1.0)" },
      })
    );
    clearTimeout(timer);
    return {
      ...base,
      reachable: res.ok || res.status < 500,
      status: res.status,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      ...base,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function preflightAllSources(
  sources: TmdbNativeSource[]
): Promise<PreflightResult[]> {
  return Promise.all(sources.map((s) => preflightSource(s)));
}

export function formatPreflightHelp(results: PreflightResult[]): string {
  const failed = results.filter((r) => !r.reachable);
  if (!failed.length) return "";
  const lines = failed.map(
    (r) => `  - ${r.sourceName} (${r.mainUrl}): ${r.error ?? `HTTP ${r.status}`}`
  );
  return [
    "TMDB-native embed hosts unreachable from this network.",
    "Run the benchmark from your home LAN.",
    "",
    ...lines,
  ].join("\n");
}
