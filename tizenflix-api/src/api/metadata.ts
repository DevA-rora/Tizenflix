import type { MediaType, Metadata } from "../types.js";
import { METADATA_BASE } from "../constants/servers.js";
import { VIDKING_HEADERS } from "../constants/headers.js";

interface TmdbGenre {
  id?: number;
  name?: string;
}

interface TmdbMovieResponse {
  title?: string;
  release_date?: string;
  original_language?: string;
  genres?: TmdbGenre[];
  external_ids?: { imdb_id?: string };
}

interface TmdbTvResponse {
  name?: string;
  first_air_date?: string;
  original_language?: string;
  genres?: TmdbGenre[];
  external_ids?: { imdb_id?: string };
}

function parseGenres(data: TmdbMovieResponse & TmdbTvResponse) {
  const genres = Array.isArray(data.genres) ? data.genres : [];
  return {
    genres: genres.map((g) => g.name ?? "").filter(Boolean),
    genreIds: genres.map((g) => g.id).filter((id): id is number => typeof id === "number"),
    originalLanguage: data.original_language ?? undefined,
  };
}

/** fa() — fetch title/year/imdb from wingsdatabase TMDB proxy */
export async function fetchMetadata(
  type: MediaType,
  tmdbId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Metadata> {
  const url = `${METADATA_BASE}/${type}/${tmdbId}?append_to_response=external_ids`;
  const res = await fetchImpl(url, { headers: VIDKING_HEADERS });
  if (!res.ok) {
    throw new Error(`TMDB metadata request failed: ${res.status}`);
  }

  const data = (await res.json()) as TmdbMovieResponse & TmdbTvResponse;

  const genreMeta = parseGenres(data);

  if (type === "movie") {
    return {
      title: data.title ?? "",
      year: data.release_date
        ? new Date(data.release_date).getFullYear()
        : "",
      imdbId: data.external_ids?.imdb_id ?? "",
      ...genreMeta,
    };
  }

  return {
    title: data.name ?? "",
    year: data.first_air_date
      ? new Date(data.first_air_date).getFullYear()
      : "",
    imdbId: data.external_ids?.imdb_id ?? "",
    ...genreMeta,
  };
}
