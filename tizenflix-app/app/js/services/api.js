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

function warmStreamUrl(url) {
  return config.fetchWithTimeout(url, 8000).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

function fetchPlaySubtitlesMovie(tmdbId) {
  return config.apiGet("/play/subtitles/movie/" + encodeURIComponent(tmdbId));
}

function fetchPlaySubtitlesTv(tmdbId, season, episode) {
  return config.apiGet(
    "/play/subtitles/tv/" +
      encodeURIComponent(tmdbId) +
      "/" +
      encodeURIComponent(season) +
      "/" +
      encodeURIComponent(episode)
  );
}

function listGenres(type) {
  return config.apiGet("/browse/genres?type=" + encodeURIComponent(type || "movie"));
}

function browseGenre(genreId, type, page) {
  var q = "?type=" + encodeURIComponent(type || "movie");
  if (page) q += "&page=" + encodeURIComponent(page);
  return config.apiGet("/browse/genre/" + encodeURIComponent(genreId) + q);
}

function getStreamflixProviders() {
  return config.apiGet("/providers/streamflix");
}

function toggleStreamflixProvider(id, enabled) {
  return config.apiPost("/providers/streamflix/toggle", { id: id, enabled: enabled });
}

function getLiveProviders() {
  return config.apiGet("/live/providers");
}

function getLiveChannels(providerId) {
  return config.apiGet("/live/" + encodeURIComponent(providerId) + "/channels");
}

function resolveLiveChannel(providerId, channelId) {
  return config.apiGet(
    "/live/" + encodeURIComponent(providerId) + "/play/" + encodeURIComponent(channelId)
  );
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
  warmStreamUrl: warmStreamUrl,
  fetchPlaySubtitlesMovie: fetchPlaySubtitlesMovie,
  fetchPlaySubtitlesTv: fetchPlaySubtitlesTv,
  listGenres: listGenres,
  browseGenre: browseGenre,
  getStreamflixProviders: getStreamflixProviders,
  toggleStreamflixProvider: toggleStreamflixProvider,
  getLiveProviders: getLiveProviders,
  getLiveChannels: getLiveChannels,
  resolveLiveChannel: resolveLiveChannel,
};
