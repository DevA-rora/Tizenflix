const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(path: string | null | undefined, size = "w500"): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path: string | null | undefined, size = "w1280"): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function logoUrl(path: string | null | undefined, size = "w500"): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

async function tmdbFetch<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TMDB ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface CatalogItem {
  id: string;
  type: "movie" | "tv";
  title: string;
  year: number | null;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: number | null;
  runtime: number | null;
}

function mapMovie(m: Record<string, unknown>): CatalogItem {
  const year = m.release_date
    ? new Date(String(m.release_date)).getFullYear()
    : null;
  return {
    id: String(m.id),
    type: "movie",
    title: String(m.title ?? ""),
    year,
    overview: String(m.overview ?? ""),
    poster: posterUrl(m.poster_path as string | null),
    backdrop: backdropUrl(m.backdrop_path as string | null),
    rating: typeof m.vote_average === "number" ? m.vote_average : null,
    runtime: typeof m.runtime === "number" ? m.runtime : null,
  };
}

function mapTv(m: Record<string, unknown>): CatalogItem {
  const year = m.first_air_date
    ? new Date(String(m.first_air_date)).getFullYear()
    : null;
  return {
    id: String(m.id),
    type: "tv",
    title: String(m.name ?? ""),
    year,
    overview: String(m.overview ?? ""),
    poster: posterUrl(m.poster_path as string | null),
    backdrop: backdropUrl(m.backdrop_path as string | null),
    rating: typeof m.vote_average === "number" ? m.vote_average : null,
    runtime: null,
  };
}

export async function searchMulti(
  apiKey: string,
  query: string,
  page = 1
): Promise<{ results: CatalogItem[]; page: number; totalPages: number }> {
  const data = await tmdbFetch<{
    results: Record<string, unknown>[];
    page: number;
    total_pages: number;
  }>("/search/multi", apiKey, {
    query,
    page: String(page),
    include_adult: "false",
  });

  const results = data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) =>
      r.media_type === "movie" ? mapMovie(r) : mapTv(r)
    );

  return { results, page: data.page, totalPages: data.total_pages };
}

export interface PersonSuggestion {
  id: string;
  name: string;
}

export async function searchPerson(
  apiKey: string,
  query: string,
  page = 1
): Promise<{ results: PersonSuggestion[] }> {
  const data = await tmdbFetch<{
    results: Record<string, unknown>[];
  }>("/search/person", apiKey, {
    query,
    page: String(page),
    include_adult: "false",
  });

  const results = data.results.map((p) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
  }));

  return { results };
}

export interface TitleDetail extends CatalogItem {
  genres?: string[];
  logo?: string | null;
  trailerKey?: string | null;
  certification?: string | null;
  numberOfSeasons?: number | null;
}

interface TmdbLogo {
  file_path: string;
  iso_639_1: string | null;
  vote_average?: number;
}

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

function pickBestLogo(logos: TmdbLogo[]): string | null {
  var best: TmdbLogo | null = null;
  for (var i = 0; i < logos.length; i++) {
    var logo = logos[i];
    if (!logo.file_path) continue;
    if (logo.iso_639_1 === "en") {
      if (!best || (logo.vote_average || 0) > (best.vote_average || 0)) {
        best = logo;
      }
    }
  }
  if (!best) {
    for (var j = 0; j < logos.length; j++) {
      if (logos[j].file_path) {
        best = logos[j];
        break;
      }
    }
  }
  return best ? logoUrl(best.file_path, "w500") : null;
}

function pickTrailerKey(videos: TmdbVideo[]): string | null {
  var priorities = ["Trailer", "Clip", "Teaser"];
  for (var p = 0; p < priorities.length; p++) {
    var targetType = priorities[p];
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.site !== "YouTube" || !v.key) continue;
      if (v.type === targetType && v.official) return v.key;
    }
    for (var j = 0; j < videos.length; j++) {
      var v2 = videos[j];
      if (v2.site !== "YouTube" || !v2.key) continue;
      if (v2.type === targetType) return v2.key;
    }
  }
  return null;
}

async function getMovieCertification(
  apiKey: string,
  tmdbId: string
): Promise<string | null> {
  try {
    const data = await tmdbFetch<{
      results?: Array<{
        iso_3166_1: string;
        release_dates?: Array<{ certification?: string }>;
      }>;
    }>(`/movie/${tmdbId}/release_dates`, apiKey);
    const results = data.results || [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].iso_3166_1 !== "US") continue;
      const dates = results[i].release_dates || [];
      for (var j = 0; j < dates.length; j++) {
        const cert = dates[j].certification;
        if (cert) return cert;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function getTitle(
  apiKey: string,
  type: "movie" | "tv",
  tmdbId: string
): Promise<TitleDetail> {
  const [data, imagesData, videosData, certification] = await Promise.all([
    tmdbFetch<Record<string, unknown>>(`/${type}/${tmdbId}`, apiKey),
    tmdbFetch<{ logos?: TmdbLogo[] }>(`/${type}/${tmdbId}/images`, apiKey).catch(
      () => ({ logos: [] as TmdbLogo[] })
    ),
    tmdbFetch<{ results?: TmdbVideo[] }>(`/${type}/${tmdbId}/videos`, apiKey).catch(
      () => ({ results: [] as TmdbVideo[] })
    ),
    type === "movie" ? getMovieCertification(apiKey, tmdbId) : Promise.resolve(null),
  ]);

  const base = type === "movie" ? mapMovie(data) : mapTv(data);
  const genres = Array.isArray(data.genres)
    ? (data.genres as Array<{ name: string }>).map((g) => g.name)
    : [];
  if (type === "movie" && typeof data.runtime === "number") {
    base.runtime = data.runtime;
  }

  const logo = pickBestLogo(imagesData.logos || []);
  const trailerKey = pickTrailerKey(videosData.results || []);
  const numberOfSeasons =
    type === "tv" && typeof data.number_of_seasons === "number"
      ? data.number_of_seasons
      : null;

  return { ...base, genres, logo, trailerKey, certification, numberOfSeasons };
}

export interface SeasonSummary {
  season: number;
  name: string;
  episodeCount: number;
  poster: string | null;
}

export interface EpisodeSummary {
  season: number;
  episode: number;
  title: string;
  overview: string;
  runtime: number | null;
  still: string | null;
}

export async function getSeasons(
  apiKey: string,
  tmdbId: string
): Promise<SeasonSummary[]> {
  const data = await tmdbFetch<{ seasons: Record<string, unknown>[] }>(
    `/tv/${tmdbId}`,
    apiKey
  );
  return (data.seasons ?? [])
    .filter((s) => Number(s.season_number) > 0)
    .map((s) => ({
      season: Number(s.season_number),
      name: String(s.name ?? ""),
      episodeCount: Number(s.episode_count ?? 0),
      poster: posterUrl(s.poster_path as string | null, "w342"),
    }));
}

export async function getSeasonEpisodes(
  apiKey: string,
  tmdbId: string,
  season: number
): Promise<EpisodeSummary[]> {
  const data = await tmdbFetch<{ episodes: Record<string, unknown>[] }>(
    `/tv/${tmdbId}/season/${season}`,
    apiKey
  );
  return (data.episodes ?? []).map((e) => ({
    season,
    episode: Number(e.episode_number),
    title: String(e.name ?? ""),
    overview: String(e.overview ?? ""),
    runtime: typeof e.runtime === "number" ? e.runtime : null,
    still: posterUrl(e.still_path as string | null, "w300"),
  }));
}

export async function trendingMovies(
  apiKey: string,
  page = 1
): Promise<CatalogItem[]> {
  const data = await tmdbFetch<{ results: Record<string, unknown>[] }>(
    "/trending/movie/week",
    apiKey,
    { page: String(page) }
  );
  return data.results.map(mapMovie);
}

export async function trendingTv(
  apiKey: string,
  page = 1
): Promise<CatalogItem[]> {
  const data = await tmdbFetch<{ results: Record<string, unknown>[] }>(
    "/trending/tv/week",
    apiKey,
    { page: String(page) }
  );
  return data.results.map(mapTv);
}

export async function popularMovies(
  apiKey: string,
  page = 1
): Promise<CatalogItem[]> {
  const data = await tmdbFetch<{ results: Record<string, unknown>[] }>(
    "/movie/popular",
    apiKey,
    { page: String(page) }
  );
  return data.results.map(mapMovie);
}

export async function popularTv(
  apiKey: string,
  page = 1
): Promise<CatalogItem[]> {
  const data = await tmdbFetch<{ results: Record<string, unknown>[] }>(
    "/tv/popular",
    apiKey,
    { page: String(page) }
  );
  return data.results.map(mapTv);
}
