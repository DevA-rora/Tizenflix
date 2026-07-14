import type { ContentProvider } from "./providers/types.js";

export const EN_PROVIDER_ORDER = [
  "sflix",
  "ridomovies",
  "superstream",
  "streaming-community-en",
  "anymovie",
];

export const ANIME_PROVIDER_ORDER = ["hianime", "anikoto", "ani-world", "anime-world"];

export const DE_PROVIDER_ORDER = ["film-palast", "hd-filme", "mega-kino", "serien-stream"];

/** Per-provider timeout for auto waterfall step 1. */
export const AUTO_PROVIDER_TIMEOUT_MS = 15_000;

/** Max scraper attempts during backend=auto step 1 (first + fallbacks). */
export const MAX_AUTO_PROVIDER_ATTEMPTS = 3;

export function firstAutoProviderId(
  isAnime: boolean,
  preferredProviderId?: string
): string {
  if (preferredProviderId) return preferredProviderId;
  if (isAnime) return ANIME_PROVIDER_ORDER[0]!;
  return EN_PROVIDER_ORDER[0]!;
}

export function simplifyProviderLang(lang: string): string {
  return lang.trim().toLowerCase().split("-")[0] || "en";
}

export function providerOrderForLang(lang: string, isAnime: boolean): string[] {
  const l = simplifyProviderLang(lang);
  if (isAnime) return [...ANIME_PROVIDER_ORDER];
  if (l === "de") return [...DE_PROVIDER_ORDER, ...EN_PROVIDER_ORDER];
  return [...EN_PROVIDER_ORDER];
}

function providerMatchesCatalogLang(provider: ContentProvider, catalogLang: string): boolean {
  const pl = simplifyProviderLang(provider.language);
  const cl = simplifyProviderLang(catalogLang);
  if (pl === cl) return true;
  if (pl === "en" && cl === "en") return true;
  if (pl === "multi") return true;
  return false;
}

/** Order enabled providers for catalog lang; optional preferred id is tried first. */
export function orderProviders(
  providers: ContentProvider[],
  lang: string,
  isAnime: boolean,
  preferredProviderId?: string
): ContentProvider[] {
  const priority = providerOrderForLang(lang, isAnime);
  const filtered = isAnime
    ? providers.filter((p) => ANIME_PROVIDER_ORDER.includes(p.id))
    : providers.filter((p) => providerMatchesCatalogLang(p, lang));

  const byId = new Map(filtered.map((p) => [p.id, p]));
  const ordered: ContentProvider[] = [];
  const seen = new Set<string>();

  const tryAdd = (id: string) => {
    if (seen.has(id)) return;
    const p = byId.get(id);
    if (!p) return;
    seen.add(id);
    ordered.push(p);
  };

  if (preferredProviderId) tryAdd(preferredProviderId);
  for (const id of priority) tryAdd(id);
  for (const p of filtered) tryAdd(p.id);

  return ordered;
}
