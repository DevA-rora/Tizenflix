import type { TmdbNativeResolveOpts } from "./types.js";
import { AUTO_TMDB_SOURCE_IDS } from "./auto-sources.js";

/** Simplified language code from `en-US` → `en`. */
export function simplifyLang(lang?: string): string {
  if (!lang) return "en";
  return lang.toLowerCase().split("-")[0]!;
}

/**
 * TMDB-native source IDs to try for a given language (mirrors Streamflix TmdbProvider.getServers).
 * English uses the default auto race list; other locales prepend locale-specific sources.
 */
export function tmdbSourceIdsForLanguage(
  type: "movie" | "tv",
  lang?: string
): string[] {
  const code = simplifyLang(lang);
  const base = [...AUTO_TMDB_SOURCE_IDS];

  if (code === "de") {
    const de: string[] = ["moflix"];
    if (type === "movie") de.push("einschalten");
    de.push("videasy", ...base);
    return de;
  }

  if (code === "fr") {
    return ["frembed", "afterdark", ...base];
  }

  if (code === "it") {
    return ["vixsrc"];
  }

  return base;
}

export function mergeOrderForLanguage(
  type: "movie" | "tv",
  lang?: string,
  override?: string[]
): string[] {
  if (override?.length) return override;
  return tmdbSourceIdsForLanguage(type, lang);
}

/** Pass language through resolve opts when building TMDB-native requests. */
export function withLanguageOpts<T extends TmdbNativeResolveOpts>(opts: T, lang?: string): T {
  return { ...opts, lang: lang ?? opts.lang ?? "en" };
}
