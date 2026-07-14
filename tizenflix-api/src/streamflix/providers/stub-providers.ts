/** Anime + VOD stub providers — full implementations via shared factories */
import { createSearchHtmlProvider } from "./shared/search-html.js";
import type { ContentProvider } from "./types.js";

export const animeAv1Provider = createSearchHtmlProvider({
  id: "anime-av1",
  name: "AnimeAV1",
  language: "es",
  baseUrl: "https://animeav1.com/",
  supportsMovies: false,
  supportsTv: true,
  searchPath: (t) => `?s=${encodeURIComponent(t)}`,
});

export const animeUnityProvider = createSearchHtmlProvider({
  id: "anime-unity",
  name: "AnimeUnity",
  language: "it",
  baseUrl: "https://www.animeunity.so/",
  supportsMovies: true,
  supportsTv: true,
  searchPath: (t) => `/archivio?title=${encodeURIComponent(t)}`,
  cardSelector: ".poster, .card, article",
});

export const animeSaturnProvider = createSearchHtmlProvider({
  id: "anime-saturn",
  name: "AnimeSaturn",
  language: "it",
  baseUrl: "https://www.animesaturn.cx/",
  supportsMovies: false,
  supportsTv: true,
  searchPath: (t) => `/animelist?search=${encodeURIComponent(t)}`,
});

export const animefenixProvider = createSearchHtmlProvider({
  id: "animefenix",
  name: "Animefenix",
  language: "es",
  baseUrl: "https://www.animefenix.tv/",
  supportsMovies: false,
  supportsTv: true,
  searchPath: (t) => `/animes?search=${encodeURIComponent(t)}`,
});

export const latanimeProvider = createSearchHtmlProvider({
  id: "latanime",
  name: "Latanime",
  language: "es",
  baseUrl: "https://latanime.org/",
  supportsMovies: true,
  supportsTv: true,
  searchPath: (t) => `/animes?search=${encodeURIComponent(t)}`,
});

export const laCartoonsProvider = createSearchHtmlProvider({
  id: "la-cartoons",
  name: "La Cartoons",
  language: "es",
  baseUrl: "https://www.lacartoons.com/",
  supportsMovies: false,
  supportsTv: true,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

export const frenchMangaProvider = createSearchHtmlProvider({
  id: "french-manga",
  name: "FrenchManga",
  language: "fr",
  baseUrl: "https://french-manga.net/",
  supportsMovies: false,
  supportsTv: true,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

export const animeBumProvider = createSearchHtmlProvider({
  id: "anime-bum",
  name: "AnimeBum",
  language: "es",
  baseUrl: "https://animebum.net/",
  supportsMovies: false,
  supportsTv: true,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

export const otakufrProvider = createSearchHtmlProvider({
  id: "otakufr",
  name: "Otakufr",
  language: "fr",
  baseUrl: "https://otakufr.cc/",
  supportsMovies: false,
  supportsTv: true,
  searchPath: (t) => `/search/${encodeURIComponent(t)}`,
});

export const seriesFlixProvider = createSearchHtmlProvider({
  id: "series-flix",
  name: "SeriesFlix",
  language: "es",
  baseUrl: "https://seriesflix2.store/",
  supportsMovies: false,
  supportsTv: true,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

export const pelisplustoProvider = createSearchHtmlProvider({
  id: "pelisplusto",
  name: "Pelisplusto",
  language: "es",
  baseUrl: "https://pelisplusto.me/",
  supportsMovies: true,
  supportsTv: true,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

export const guardaFlixProvider = createSearchHtmlProvider({
  id: "guarda-flix",
  name: "GuardaFlix",
  language: "it",
  baseUrl: "https://guardaflix.info/",
  supportsMovies: true,
  supportsTv: false,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

export const kidrazProvider = createSearchHtmlProvider({
  id: "kidraz",
  name: "Kidraz",
  language: "fr",
  baseUrl: "https://kidraz.com/",
  supportsMovies: true,
  supportsTv: false,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

export const streamingItaProvider = createSearchHtmlProvider({
  id: "streaming-ita",
  name: "StreamingIta",
  language: "it",
  baseUrl: "https://streamingita.homes/",
  supportsMovies: true,
  supportsTv: true,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

export const unJourUnFilmProvider = createSearchHtmlProvider({
  id: "un-jour-un-film",
  name: "1Jour1Film",
  language: "fr",
  baseUrl: "https://1jour1film.buzz/",
  supportsMovies: true,
  supportsTv: true,
  searchPath: (t) => `/?s=${encodeURIComponent(t)}`,
});

/** Re-export map for registry convenience */
export const STUB_PROVIDERS: ContentProvider[] = [
  animeAv1Provider,
  animeUnityProvider,
  animeSaturnProvider,
  animefenixProvider,
  latanimeProvider,
  laCartoonsProvider,
  frenchMangaProvider,
  animeBumProvider,
  otakufrProvider,
  seriesFlixProvider,
  pelisplustoProvider,
  guardaFlixProvider,
  kidrazProvider,
  streamingItaProvider,
  unJourUnFilmProvider,
];
