/**
 * Active playback context — title metadata, sources, subtitles, next episode.
 */

var current = null;
var prefetchCache = null;
var warmedManifestUrl = null;
var PREFETCH_TTL_MS = 5 * 60 * 1000;

function prefetchKey(type, tmdbId, season, episode) {
  return type + ":" + tmdbId + ":" + (season || "") + ":" + (episode || "");
}

function setPrefetch(key, play) {
  prefetchCache = { key: key, play: play, fetchedAt: Date.now() };
}

function getPrefetch(key) {
  if (!prefetchCache || prefetchCache.key !== key) return null;
  if (Date.now() - prefetchCache.fetchedAt > PREFETCH_TTL_MS) {
    prefetchCache = null;
    return null;
  }
  return prefetchCache.play;
}

function clearPrefetch() {
  prefetchCache = null;
  warmedManifestUrl = null;
}

function setWarmedManifest(url) {
  warmedManifestUrl = url || null;
}

function getWarmedManifest() {
  return warmedManifestUrl;
}

function create(meta) {
  meta = meta || {};
  current = {
    tmdbId: meta.tmdbId || null,
    type: meta.type || "movie",
    season: meta.season || null,
    episode: meta.episode || null,
    title: meta.title || "",
    showTitle: meta.showTitle || meta.title || "",
    episodeTitle: meta.episodeTitle || "",
    overview: meta.overview || "",
    metaLine: meta.metaLine || "",
    play: null,
    sources: [],
    currentSourceIndex: 0,
    subtitles: [],
    activeSubtitleIndex: -1,
    nextEpisode: null,
    displayTitle: meta.displayTitle || meta.title || "",
  };
  return current;
}

function get() {
  return current;
}

function update(patch) {
  if (!current || !patch) return current;
  for (var key in patch) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      current[key] = patch[key];
    }
  }
  return current;
}

function setFromPlay(play, sources, extras) {
  if (!current) return null;
  extras = extras || {};
  current.play = play;
  current.sources = sources || [];
  current.currentSourceIndex = 0;
  current.subtitles = (play && play.subtitles) || [];
  current.activeSubtitleIndex = -1;
  current.nextEpisode = play && play.nextEpisode ? play.nextEpisode : null;
  if (play && play.title && !current.showTitle) current.showTitle = play.title;
  if (extras.displayTitle) current.displayTitle = extras.displayTitle;
  return current;
}

function clear() {
  current = null;
}

module.exports = {
  create: create,
  get: get,
  update: update,
  setFromPlay: setFromPlay,
  clear: clear,
  prefetchKey: prefetchKey,
  setPrefetch: setPrefetch,
  getPrefetch: getPrefetch,
  clearPrefetch: clearPrefetch,
  setWarmedManifest: setWarmedManifest,
  getWarmedManifest: getWarmedManifest,
};
