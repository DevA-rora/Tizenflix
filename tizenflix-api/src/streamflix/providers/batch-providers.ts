/**
 * Batch B–E provider configs — HTML scrape providers enabled via factory.
 */
import { createHtmlProvider, parseCardSearch, scrapeEmbedServers } from "./shared/html-scraper.js";
import type { ContentProvider } from "./types.js";

function htmlProvider(
  id: string,
  name: string,
  language: string,
  baseUrl: string,
  searchTpl: (title: string) => string,
  opts: { movies?: boolean; tv?: boolean; playwright?: boolean } = {}
): ContentProvider {
  const movies = opts.movies ?? true;
  const tv = opts.tv ?? true;
  return createHtmlProvider({
    id,
    name,
    language,
    baseUrl,
    supportsMovies: movies,
    supportsTv: tv,
    implementationStatus: "full",
    requiresPlaywright: opts.playwright ?? false,
    searchPath: (title) => searchTpl(title),
    parseSearch: (html, title) => {
      const cards = parseCardSearch(html, baseUrl, ".item, .post, article, .flw-item", "a");
      const norm = title.toLowerCase();
      return cards.filter((c) => c.title.toLowerCase().includes(norm.slice(0, 6)));
    },
    getServers: async (match) => scrapeEmbedServers(match.contentId, baseUrl),
  });
}

export const cuevanaEuProvider = htmlProvider(
  "cuevana-eu",
  "Cuevana 3",
  "es",
  "https://www.cuevana3.ai/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const cineCalidadProvider = htmlProvider(
  "cine-calidad",
  "CineCalidad",
  "es",
  "https://www.cinecalidad.ec/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const frenchStreamProvider = htmlProvider(
  "french-stream",
  "FrenchStream",
  "fr",
  "https://www.french-stream.gratis/",
  (t) => `index.php?story=${encodeURIComponent(t)}&do=search`
);

export const serienStreamProvider = htmlProvider(
  "serien-stream",
  "SerienStream",
  "de",
  "https://serienstream.to/",
  (t) => `search?q=${encodeURIComponent(t)}`,
  { movies: false, tv: true }
);

export const hdFilmeProvider = htmlProvider(
  "hd-filme",
  "HDFilme",
  "de",
  "https://hdfilme.cx/",
  (t) => `search?q=${encodeURIComponent(t)}`
);

export const cb01Provider = htmlProvider(
  "cb01",
  "CB01",
  "it",
  "https://cb01.uno/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const guardaSerieProvider = htmlProvider(
  "guarda-serie",
  "GuardaSerie",
  "it",
  "https://guardaserie.tools/",
  (t) => `?s=${encodeURIComponent(t)}`,
  { movies: false, tv: true }
);

export const filmPalastProvider = htmlProvider(
  "film-palast",
  "FilmPalast",
  "de",
  "https://filmpalast.to/",
  (t) => `search/${encodeURIComponent(t)}`
);

export const zeriunProvider = htmlProvider(
  "zeriun",
  "Zeriun",
  "pl",
  "https://zeriun.com/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const doramasflixProvider = htmlProvider(
  "doramasflix",
  "Doramasflix",
  "es",
  "https://doramasflix.co/",
  (t) => `?s=${encodeURIComponent(t)}`,
  { movies: false, tv: true }
);

export const einschaltenProvider = htmlProvider(
  "einschalten",
  "Einschalten",
  "de",
  "https://einschalten.in/",
  (t) => `?s=${encodeURIComponent(t)}`,
  { tv: false }
);

export const megaKinoProvider = htmlProvider(
  "mega-kino",
  "MEGAKino",
  "de",
  "https://megakino.zone/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const altadefinizione01Provider = htmlProvider(
  "altadefinizione01",
  "Altadefinizione01",
  "it",
  "https://altadefinizione01.bingo/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const pelisflixHdProvider = htmlProvider(
  "pelisflix-hd",
  "PelisflixHd",
  "es",
  "https://pelisflix2.green/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const soloLatinoProvider = htmlProvider(
  "solo-latino",
  "SoloLatino",
  "es",
  "https://sololatino.net/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const flixLatamProvider = htmlProvider(
  "flix-latam",
  "FlixLatam",
  "es",
  "https://flixlatam.com/",
  (t) => `?s=${encodeURIComponent(t)}`
);

export const animeWorldProvider = htmlProvider(
  "anime-world",
  "AnimeWorld",
  "it",
  "https://www.animeworld.ac/",
  (t) => `search?q=${encodeURIComponent(t)}`,
  { movies: true, tv: true }
);

export const aniWorldProvider = htmlProvider(
  "ani-world",
  "AniWorld",
  "de",
  "https://aniworld.to/",
  (t) => `search?q=${encodeURIComponent(t)}`,
  { movies: false, tv: true }
);

export const frenchAnimeProvider = htmlProvider(
  "french-anime",
  "FrenchAnime",
  "fr",
  "https://french-anime.com/",
  (t) => `?s=${encodeURIComponent(t)}`,
  { movies: false, tv: true }
);

export const mkissaProvider = htmlProvider(
  "mkissa",
  "Mkissa",
  "en",
  "https://allanime.day/",
  (t) => `search?q=${encodeURIComponent(t)}`,
  { movies: true, tv: true }
);

/** Playwright-first providers — enabled but flagged */
export const cine24hProvider = htmlProvider(
  "cine24h",
  "Cine24h",
  "es",
  "https://cine24h.net/",
  (t) => `?s=${encodeURIComponent(t)}`,
  { playwright: true }
);

export const filmyOnlineCcProvider = htmlProvider(
  "filmy-online-cc",
  "FilmyOnline",
  "pl",
  "https://filmyonline.cc/",
  (t) => `?s=${encodeURIComponent(t)}`,
  { playwright: true }
);

export const poseidonHd2Provider = htmlProvider(
  "poseidon-hd2",
  "PoseidonHD2",
  "es",
  "https://poseidonhd2.com/",
  (t) => `?s=${encodeURIComponent(t)}`,
  { playwright: true }
);

export const animeOnlineNinjaProvider = htmlProvider(
  "anime-online-ninja",
  "AnimeOnlineNinja",
  "es",
  "https://www.animeonline.ninja/",
  (t) => `?s=${encodeURIComponent(t)}`,
  { playwright: true }
);
