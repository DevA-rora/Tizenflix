/**
 * API client — catalog (TMDB via tizenflix-api) + playback resolve.
 */

var config = require("../core/config.js");

function getBase() {
  return config.getApiBase();
}

function health() {
  return config.checkHealth(getBase());
}

function browseRows() {
  return config.apiGet("/browse/rows");
}

function browseRow(rowId, page) {
  var q = page ? "?page=" + encodeURIComponent(page) : "";
  return config.apiGet("/browse/row/" + encodeURIComponent(rowId) + q);
}

function search(query, page) {
  var q = "?q=" + encodeURIComponent(query);
  if (page) q += "&page=" + encodeURIComponent(page);
  return config.apiGet("/search" + q);
}

function getMovie(tmdbId) {
  return config.apiGet("/title/movie/" + encodeURIComponent(tmdbId));
}

function getTv(tmdbId) {
  return config.apiGet("/title/tv/" + encodeURIComponent(tmdbId));
}

function getSeasons(tmdbId) {
  return config.apiGet("/title/tv/" + encodeURIComponent(tmdbId) + "/seasons");
}

function getEpisodes(tmdbId, season) {
  return config.apiGet(
    "/title/tv/" + encodeURIComponent(tmdbId) + "/" + encodeURIComponent(season) + "/episodes"
  );
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
  browseRows: browseRows,
  browseRow: browseRow,
  search: search,
  getMovie: getMovie,
  getTv: getTv,
  getSeasons: getSeasons,
  getEpisodes: getEpisodes,
  resolveMovie: resolveMovie,
  resolveTvEpisode: resolveTvEpisode,
  sourcesForPlay: sourcesForPlay,
};
