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

function searchSuggest(query) {
  return config.apiGet("/search/suggest?q=" + encodeURIComponent(query));
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

function resolveMovie(tmdbId, extraQuery, timeoutMs) {
  return config.resolveMovie(getBase(), tmdbId, config.buildPlayQuery(extraQuery), timeoutMs);
}

function resolveTvEpisode(tmdbId, season, episode, extraQuery, timeoutMs) {
  return config.resolveTvEpisode(
    getBase(),
    tmdbId,
    season,
    episode,
    config.buildPlayQuery(extraQuery),
    timeoutMs
  );
}

function sourcesForPlay(play) {
  return config.listSourcesToTry(play);
}

function hasPlayableSources(play) {
  return sourcesForPlay(play).length > 0;
}

function getProviders() {
  return config.apiGet("/providers/tmdb-native");
}

function continueWatching(limit) {
  var q = limit ? "?limit=" + encodeURIComponent(limit) : "";
  return config.apiGet("/continue-watching" + q).then(function (data) {
    return data.items || [];
  });
}

function saveProgress(payload) {
  return config.apiPost("/progress", payload);
}

module.exports = {
  getBase: getBase,
  setBase: config.setApiBase,
  health: health,
  browseRows: browseRows,
  browseRow: browseRow,
  search: search,
  searchSuggest: searchSuggest,
  getMovie: getMovie,
  getTv: getTv,
  getSeasons: getSeasons,
  getEpisodes: getEpisodes,
  resolveMovie: resolveMovie,
  resolveTvEpisode: resolveTvEpisode,
  sourcesForPlay: sourcesForPlay,
  hasPlayableSources: hasPlayableSources,
  getProviders: getProviders,
  continueWatching: continueWatching,
  saveProgress: saveProgress,
};
