/**
 * Start playback from any screen — shared by home, detail, etc.
 */

var api = require("./api.js");
var player = require("../player/player.js");
var debug = require("../core/debug.js");

function playResolved(play, title, onStatus) {
  var video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (!video || !wrap) return Promise.reject(new Error("Video element missing"));

  var sources = api.sourcesForPlay(play);
  if (!sources.length) {
    var msg =
      play.warnings && play.warnings.length
        ? play.warnings.join("; ")
        : "No playable sources";
    return Promise.reject(new Error(msg));
  }

  wrap.classList.remove("hidden");
  var titleEl = document.getElementById("playbackTitle");
  if (titleEl) titleEl.textContent = title || play.title || "";
  debug.debugClear();
  debug.debugLog("Playing: " + (title || play.title || ""));

  function log(msg) {
    debug.debugLog(msg);
    if (onStatus) onStatus(msg);
  }

  player.playSources(video, sources, log, wrap, title || play.title || "Playback");
  return Promise.resolve();
}

function playMovie(tmdbId, title, onStatus) {
  if (onStatus) onStatus("Resolving movie...");
  return api.resolveMovie(tmdbId).then(function (play) {
    return playResolved(play, title, onStatus);
  });
}

function playTvEpisode(tmdbId, season, episode, title, onStatus) {
  if (onStatus) onStatus("Resolving episode...");
  return api
    .resolveTvEpisode(tmdbId, season, episode)
    .then(function (play) {
      return playResolved(play, title, onStatus);
    });
}

function stop() {
  var video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (video) {
    player.destroyPlayer(video);
    video.removeAttribute("controls");
    video.removeAttribute("crossorigin");
  }
  player.exitPlaybackMode();
  if (wrap) wrap.classList.add("hidden");
}

module.exports = {
  playResolved: playResolved,
  playMovie: playMovie,
  playTvEpisode: playTvEpisode,
  stop: stop,
};
