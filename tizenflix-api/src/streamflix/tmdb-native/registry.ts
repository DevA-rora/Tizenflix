import { createHash } from "node:crypto";
import { buildAfterDarkEntries } from "../extractors/after-dark.js";
import { buildFrembedEntries } from "../extractors/frembed.js";
import { buildMoflixEntries } from "../extractors/moflix.js";
import { buildEinschaltenEntry } from "../extractors/einschalten.js";
import { BROWSER_UA, fetchJson } from "../http.js";
import type { TmdbNativeEntry, TmdbNativeResolveOpts, TmdbNativeSource } from "./types.js";

const VIXSRC = "https://vixsrc.to";
const MOVIESAPI = "https://moviesapi.club";
const TWOEMBED = "https://www.2embed.cc";
const VIDSRC_NET = "https://vidsrc-embed.ru";
const VIDLINK = "https://vidlink.pro";
const VIDSRC_RU = "https://vidsrc.ru";
const VIDFLIX = "https://vidflix.club";
const VIDROCK = "https://vidrock.net";
const VIDZEE = "https://player.vidzee.wtf";
const PRIMESRC = "https://primesrc.me";
const VIDSRC_TO = "https://vidsrc.to";

const VIDEASY_EN_SERVERS = [
  { name: "Neon", endpoint: "neon2", movieOnly: false },
  { name: "Yoru", endpoint: "cdn", movieOnly: false },
  { name: "Tejo", endpoint: "tejo", movieOnly: false },
  { name: "Sage", endpoint: "ym", movieOnly: false },
  { name: "Cypher", endpoint: "downloader2", movieOnly: false },
  { name: "Breach", endpoint: "m4uhd", movieOnly: false },
  { name: "Vyse", endpoint: "hdmovie", movieOnly: false },
  { name: "Jett", endpoint: "jett", movieOnly: false },
];

const VIDZEE_SERVERS = [
  "Nflix", "Duke", "Glory", "Nazy", "Atlas", "Drag", "Achilles",
  "Viet", "Velocità", "Hindi", "Bengali", "Tamil", "Telugu", "Malayalam",
];

export function buildVidrockApiUrl(opts: {
  type: "movie" | "tv";
  tmdbId: string;
  season?: string;
  episode?: string;
}): string {
  if (opts.type === "movie") return `${VIDROCK}/api/movie/${opts.tmdbId}`;
  return `${VIDROCK}/api/tv/${opts.tmdbId}/${opts.season ?? "1"}/${opts.episode ?? "1"}`;
}

async function vidrockEntries(opts: TmdbNativeResolveOpts): Promise<TmdbNativeEntry[]> {
  const apiUrl = buildVidrockApiUrl({
    type: opts.type,
    tmdbId: opts.tmdbId,
    season: opts.season,
    episode: opts.episode,
  });

  const response = await fetchJson<Record<string, { url?: string }>>(apiUrl, {
    referer: `${VIDROCK}/`,
    origin: VIDROCK,
    headers: { "User-Agent": BROWSER_UA },
  });

  const entries = Object.entries(response)
    .filter(([, v]) => v?.url)
    .map(([serverName]) => ({
      name: `${serverName} (Vidrock)`,
      url: `${apiUrl}#${serverName}`,
    }));

  if (!entries.length) throw new Error("Vidrock: api returned no servers");
  return entries;
}

function movieTvUrl(
  base: string,
  opts: TmdbNativeResolveOpts,
  moviePath: (id: string) => string,
  tvPath: (id: string, s: string, e: string) => string
): TmdbNativeEntry[] {
  if (opts.type === "movie") {
    return [{ name: base, url: moviePath(opts.tmdbId) }];
  }
  return [{
    name: base,
    url: tvPath(opts.tmdbId, opts.season ?? "1", opts.episode ?? "1"),
  }];
}

function syncSource(
  id: string,
  name: string,
  mainUrl: string,
  priority: number,
  supportsMovies: boolean,
  supportsTv: boolean,
  build: (opts: TmdbNativeResolveOpts) => TmdbNativeEntry[],
  duplicateOf?: string
): TmdbNativeSource {
  return { id, name, mainUrl, priority, supportsMovies, supportsTv, duplicateOf, buildEntries: build };
}

async function primeSrcEntries(opts: TmdbNativeResolveOpts): Promise<TmdbNativeEntry[]> {
  const apiUrl =
    opts.type === "movie"
      ? `${PRIMESRC}/api/v1/s?tmdb=${opts.tmdbId}&type=movie`
      : `${PRIMESRC}/api/v1/s?tmdb=${opts.tmdbId}&season=${opts.season ?? "1"}&episode=${opts.episode ?? "1"}&type=tv`;
  try {
    const res = await fetchJson<{ servers: Array<{ name: string; key: string }> }>(apiUrl);
    const counts = new Map<string, number>();
    return (res.servers ?? []).map((s) => {
      const n = (counts.get(s.name) ?? 0) + 1;
      counts.set(s.name, n);
      const suffix = n > 1 ? ` ${n}` : "";
      return {
        name: `${s.name}${suffix} (PrimeSrc)`,
        url: `${PRIMESRC}/api/v1/l?key=${s.key}`,
      };
    });
  } catch {
    return [];
  }
}

export const TMDB_NATIVE_SOURCES: TmdbNativeSource[] = [
  syncSource("vixsrc", "VixSrc", VIXSRC, 1, true, true, (o) =>
    movieTvUrl(VIXSRC, o, (id) => `${VIXSRC}/api/movie/${id}`, (id, s, e) => `${VIXSRC}/api/tv/${id}/${s}/${e}`)
  ),
  {
    id: "videasy",
    name: "Videasy",
    mainUrl: "https://api.wingsdatabase.com",
    priority: 2,
    supportsMovies: true,
    supportsTv: true,
    buildEntries(opts) {
      const year = String(opts.year ?? "").split("-")[0] ?? "";
      const imdb = opts.imdbId ?? "";
      return VIDEASY_EN_SERVERS.filter((c) => !(c.movieOnly && opts.type === "tv")).map((c) => {
        const base =
          opts.type === "movie"
            ? `https://api.wingsdatabase.com/${c.endpoint}/sources-with-title?title=${encodeURIComponent(opts.title)}&mediaType=movie&year=${year}&tmdbId=${opts.tmdbId}&imdbId=${imdb}`
            : `https://api.wingsdatabase.com/${c.endpoint}/sources-with-title?title=${encodeURIComponent(opts.title)}&mediaType=tv&year=${year}&tmdbId=${opts.tmdbId}&imdbId=${imdb}&episodeId=${opts.episode ?? "1"}&seasonId=${opts.season ?? "1"}`;
        return { name: `${c.name} (Videasy)`, url: base };
      });
    },
  },
  syncSource("moviesapi", "Moviesapi", MOVIESAPI, 3, true, false, (o) =>
    o.type === "movie" ? [{ name: "Moviesapi", url: `${MOVIESAPI}/movie/${o.tmdbId}` }] : []
  ),
  syncSource("twoembed", "2Embed", TWOEMBED, 4, true, true, (o) =>
    movieTvUrl(TWOEMBED, o, (id) => `${TWOEMBED}/embed/${id}`, (id, s, e) => `${TWOEMBED}/embedtv/${id}&s=${s}&e=${e}`)
  ),
  syncSource("vidsrcnet", "Vidsrc.net", VIDSRC_NET, 5, true, true, (o) =>
    movieTvUrl(
      VIDSRC_NET,
      o,
      (id) => `${VIDSRC_NET}/embed/movie?tmdb=${id}`,
      (id, s, e) => `${VIDSRC_NET}/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
    )
  ),
  syncSource("vidlink", "VidLink", VIDLINK, 6, true, true, (o) =>
    movieTvUrl(VIDLINK, o, (id) => `${VIDLINK}/movie/${id}`, (id, s, e) => `${VIDLINK}/tv/${id}/${s}/${e}`)
  ),
  syncSource("vidsrcru", "Vidsrc.Ru", VIDSRC_RU, 7, true, true, (o) =>
    movieTvUrl(VIDSRC_RU, o, (id) => `${VIDSRC_RU}/movie/${id}`, (id, s, e) => `${VIDSRC_RU}/tv/${id}/${s}/${e}`)
  ),
  syncSource("vidflix", "Vidflix", VIDFLIX, 8, true, true, (o) =>
    movieTvUrl(VIDFLIX, o, (id) => `${VIDFLIX}/api/movie/${id}`, (id, s, e) => `${VIDFLIX}/api/tv/${id}/${s}/${e}`)
  ),
  {
    id: "vidrock",
    name: "Vidrock",
    mainUrl: VIDROCK,
    priority: 9,
    supportsMovies: true,
    supportsTv: true,
    buildEntries: vidrockEntries,
  },
  {
    id: "vidzee",
    name: "Vidzee",
    mainUrl: VIDZEE,
    priority: 10,
    supportsMovies: true,
    supportsTv: true,
    buildEntries(opts) {
      const base =
        opts.type === "movie"
          ? `${VIDZEE}/api/server?id=${opts.tmdbId}`
          : `${VIDZEE}/api/server?id=${opts.tmdbId}&ss=${opts.season ?? "1"}&ep=${opts.episode ?? "1"}`;
      return VIDZEE_SERVERS.map((name, i) => ({
        name: `${name} (Vidzee)`,
        url: `${base}&sr=${i}`,
      }));
    },
  },
  {
    id: "primesrc",
    name: "PrimeSrc",
    mainUrl: PRIMESRC,
    priority: 11,
    supportsMovies: true,
    supportsTv: true,
    buildEntries: primeSrcEntries,
  },
  syncSource("vidsrcto", "Vidsrc.to", VIDSRC_TO, 12, true, true, (o) =>
    movieTvUrl(
      VIDSRC_TO,
      o,
      (id) => `${VIDSRC_TO}/embed/movie/${id}`,
      (id, s, e) => `${VIDSRC_TO}/embed/tv/${id}/${s}/${e}`
    )
  ),
  {
    id: "moflix",
    name: "Moflix",
    mainUrl: "https://moflix-stream.xyz/",
    priority: 0,
    supportsMovies: true,
    supportsTv: true,
    buildEntries: (o) => buildMoflixEntries(o),
  },
  {
    id: "frembed",
    name: "Frembed",
    mainUrl: "https://frembed.click",
    priority: 0,
    supportsMovies: true,
    supportsTv: true,
    buildEntries: (o) => buildFrembedEntries(o),
  },
  {
    id: "afterdark",
    name: "AfterDark",
    mainUrl: "https://afterdark.best",
    priority: 0,
    supportsMovies: true,
    supportsTv: true,
    buildEntries: (o) => buildAfterDarkEntries(o),
  },
  {
    id: "einschalten",
    name: "Einschalten",
    mainUrl: "https://einschalten.in",
    priority: 0,
    supportsMovies: true,
    supportsTv: false,
    buildEntries(o) {
      const entry = buildEinschaltenEntry(o);
      return entry ? [entry] : [];
    },
  },
];

export function getTmdbNativeSources(type: "movie" | "tv"): TmdbNativeSource[] {
  return TMDB_NATIVE_SOURCES.filter((s) =>
    type === "movie" ? s.supportsMovies : s.supportsTv
  ).sort((a, b) => a.priority - b.priority);
}

export function getTmdbNativeSourceById(id: string): TmdbNativeSource | undefined {
  return TMDB_NATIVE_SOURCES.find((s) => s.id === id);
}

/** SHA-256 helper exported for vidzee tests */
export function sha256(data: string): Buffer {
  return createHash("sha256").update(data).digest();
}
