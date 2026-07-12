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

export async function getTitle(
  apiKey: string,
  type: "movie" | "tv",
  tmdbId: string
): Promise<CatalogItem & { genres?: string[] }> {
  const data = await tmdbFetch<Record<string, unknown>>(
    `/${type}/${tmdbId}`,
    apiKey
  );
  const base = type === "movie" ? mapMovie(data) : mapTv(data);
  const genres = Array.isArray(data.genres)
    ? (data.genres as Array<{ name: string }>).map((g) => g.name)
    : [];
  if (type === "movie" && typeof data.runtime === "number") {
    base.runtime = data.runtime;
  }
  return { ...base, genres };
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
