import { superStreamProvider } from "./super-stream.js";
import { sflixProvider } from "./sflix.js";
import { serienStreamProvider } from "./serien-stream.js";
import { streamingCommunityItProvider } from "./streaming-community-it.js";
import { streamingCommunityEnProvider } from "./streaming-community-en.js";
import { animeWorldProvider } from "./anime-world.js";
import { mkissaProvider } from "./mkissa.js";
import { aniWorldProvider } from "./ani-world.js";
import { ridomoviesProvider } from "./ridomovies.js";
import { anikotoProvider } from "./anikoto.js";
import { wiflixProvider } from "./wiflix.js";
import { anyMovieProvider } from "./anymovie.js";
import { hiAnimeProvider } from "./hianime.js";
import { mStreamProvider } from "./m-stream.js";
import { frenchAnimeProvider } from "./french-anime.js";
import { filmPalastProvider } from "./film-palast.js";
import { poseidonHd2Provider } from "./poseidon-hd2.js";
import { cuevanaEuProvider } from "./cuevana-eu.js";
import { latanimeProvider } from "./latanime.js";
import { doramasflixProvider } from "./doramasflix.js";
import { cineCalidadProvider } from "./cine-calidad.js";
import { seriesFlixProvider } from "./series-flix.js";
import { flixLatamProvider } from "./flix-latam.js";
import { laCartoonsProvider } from "./la-cartoons.js";
import { animefenixProvider } from "./animefenix.js";
import { animeFlvProvider } from "./anime-flv.js";
import { animeAv1Provider } from "./anime-av1.js";
import { animeOnlineNinjaProvider } from "./anime-online-ninja.js";
import { soloLatinoProvider } from "./solo-latino.js";
import { cine24hProvider } from "./cine24h.js";
import { pelisplustoProvider } from "./pelisplusto.js";
import { pelisflixHdProvider } from "./pelisflix-hd.js";
import { altadefinizione01Provider } from "./altadefinizione01.js";
import { guardaFlixProvider } from "./guarda-flix.js";
import { cb01Provider } from "./cb01.js";
import { animeUnityProvider } from "./anime-unity.js";
import { animeSaturnProvider } from "./anime-saturn.js";
import { frenchStreamProvider } from "./french-stream.js";
import { guardaSerieProvider } from "./guarda-serie.js";
import { einschaltenProvider } from "./einschalten.js";
import { hdFilmeProvider } from "./hd-filme.js";
import { megaKinoProvider } from "./mega-kino.js";
import { filmyOnlineCcProvider } from "./filmy-online-cc.js";
import { zeriunProvider } from "./zeriun.js";
import { frembedProvider } from "./frembed.js";
import { kidrazProvider } from "./kidraz.js";
import { frenchMangaProvider } from "./french-manga.js";
import { unJourUnFilmProvider } from "./un-jour-un-film.js";
import { streamingItaProvider } from "./streaming-ita.js";
import { otakufrProvider } from "./otakufr.js";
import { animeBumProvider } from "./anime-bum.js";
import type { ContentProvider } from "./types.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../data/streamflix-providers.json");

const ALL_PROVIDERS: ContentProvider[] = [
  sflixProvider,
  ridomoviesProvider,
  superStreamProvider,
  streamingCommunityEnProvider,
  serienStreamProvider,
  streamingCommunityItProvider,
  animeWorldProvider,
  mkissaProvider,
  aniWorldProvider,
  anikotoProvider,
  wiflixProvider,
  anyMovieProvider,
  hiAnimeProvider,
  mStreamProvider,
  frenchAnimeProvider,
  filmPalastProvider,
  poseidonHd2Provider,
  cuevanaEuProvider,
  latanimeProvider,
  doramasflixProvider,
  cineCalidadProvider,
  seriesFlixProvider,
  flixLatamProvider,
  laCartoonsProvider,
  animefenixProvider,
  animeFlvProvider,
  animeAv1Provider,
  animeOnlineNinjaProvider,
  soloLatinoProvider,
  cine24hProvider,
  pelisplustoProvider,
  pelisflixHdProvider,
  altadefinizione01Provider,
  guardaFlixProvider,
  cb01Provider,
  animeUnityProvider,
  animeSaturnProvider,
  frenchStreamProvider,
  guardaSerieProvider,
  einschaltenProvider,
  hdFilmeProvider,
  megaKinoProvider,
  filmyOnlineCcProvider,
  zeriunProvider,
  frembedProvider,
  kidrazProvider,
  frenchMangaProvider,
  animeBumProvider,
  otakufrProvider,
  streamingItaProvider,
  unJourUnFilmProvider,
];

function loadDisabled(): Set<string> {
  if (!existsSync(CONFIG_PATH)) return new Set();
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { disabled?: string[] };
    return new Set(cfg.disabled ?? []);
  } catch {
    return new Set();
  }
}

export function getAllProviders(): ContentProvider[] {
  const disabled = loadDisabled();
  return ALL_PROVIDERS.map((p) => ({
    ...p,
    enabled: p.enabled !== false && !disabled.has(p.id),
  }));
}

export function getEnabledProviders(type: "movie" | "tv"): ContentProvider[] {
  return getAllProviders().filter((p) => {
    if (p.enabled === false) return false;
    if (p.implementationStatus === "stub") return false;
    return type === "movie" ? p.supportsMovies : p.supportsTv;
  });
}

export function findProviderById(id: string): ContentProvider | undefined {
  return getAllProviders().find((p) => p.id === id);
}

export function getProviderConfig(): { disabled: string[] } {
  if (!existsSync(CONFIG_PATH)) return { disabled: [] };
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { disabled: string[] };
  } catch {
    return { disabled: [] };
  }
}

export function setProviderEnabled(id: string, enabled: boolean): void {
  const cfg = getProviderConfig();
  const disabled = new Set(cfg.disabled ?? []);
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ disabled: [...disabled] }, null, 2));
}

export function setProviderConfig(disabled: string[]): void {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ disabled }, null, 2));
}
