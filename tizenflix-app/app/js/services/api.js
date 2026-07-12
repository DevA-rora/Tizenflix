/**
 * Thin API client — wraps config resolve helpers for screens.
 */

var config = require("../core/config.js");

function getBase() {
  return config.getApiBase();
}

function health() {
  return config.checkHealth(getBase());
}

function resolveMovie(tmdbId) {
  return config.resolveMovie(getBase(), tmdbId);
}

function resolveTvEpisode(tmdbId, season, episode) {
  return config.resolveTvEpisode(getBase(), tmdbId, season, episode);
}

function sourcesForPlay(play) {
  return config.listSourcesToTry(play);
}

module.exports = {
  getBase: getBase,
  setBase: config.setApiBase,
  health: health,
  resolveMovie: resolveMovie,
  resolveTvEpisode: resolveTvEpisode,
  sourcesForPlay: sourcesForPlay,
};
