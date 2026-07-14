import type { PlayResponse } from "../types.js";

function hostKey(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Merge multiple play responses into one multi-CDN source list. */
export function mergePlayResponses(
  base: PlayResponse,
  ...others: PlayResponse[]
): PlayResponse {
  const seen = new Set<string>();
  const sources: PlayResponse["sources"] = [];
  const subtitleMap = new Map<string, PlayResponse["subtitles"][0]>();
  const warnings: string[] = [...(base.warnings ?? [])];

  const addPlay = (play: PlayResponse) => {
    for (const w of play.warnings ?? []) {
      if (!warnings.includes(w)) warnings.push(w);
    }
    for (const sub of play.subtitles ?? []) {
      const key = `${sub.language}::${sub.url}`;
      if (!subtitleMap.has(key)) subtitleMap.set(key, sub);
    }
    for (const source of play.sources) {
      const key = hostKey(source.url);
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({ ...source, priority: sources.length });
    }
  };

  addPlay(base);
  for (const play of others) addPlay(play);

  return {
    ...base,
    sources,
    recommended: sources[0]?.id ?? null,
    subtitles: Array.from(subtitleMap.values()),
    warnings: warnings.length ? warnings : undefined,
  };
}
