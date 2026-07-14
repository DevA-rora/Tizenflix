/** TMDB genre id for Animation. */
export const TMDB_ANIMATION_GENRE_ID = 16;

export interface AnimeDetectionInput {
  genres?: string[];
  genreIds?: number[];
  originalLanguage?: string;
  title?: string;
}

const ANIME_TITLE_HINT =
  /\b(anime|re:zero|re zero|naruto|one piece|dragon ball|attack on titan|shingeki|demonslayer|demon slayer|jujutsu|my hero academia|hunter x hunter|fullmetal|bleach|fairy tail|sword art online|tokyo ghoul|death note|evangelion|cowboy bebop|spy\s*x\s*family)\b/i;

export function isAnime(input: AnimeDetectionInput): boolean {
  const genreIds = input.genreIds ?? [];
  const genres = (input.genres ?? []).map((g) => g.toLowerCase());
  const hasAnimation =
    genreIds.includes(TMDB_ANIMATION_GENRE_ID) ||
    genres.some((g) => g === "animation" || g === "anime");

  if (!hasAnimation) return false;

  const lang = (input.originalLanguage ?? "").toLowerCase().split("-")[0];
  if (lang === "ja") return true;

  const title = input.title ?? "";
  return ANIME_TITLE_HINT.test(title);
}
