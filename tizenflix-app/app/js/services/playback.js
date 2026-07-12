/**
 * Start playback from any screen — shared by home, detail, etc.
 */

var api = require("./api.js");
var config = require("../core/config.js");
var player = require("../player/player.js");
var debug = require("../core/debug.js");

var TIZEN_SERVER_FALLBACKS = [
  { label: "Oxygen", query: "server=Oxygen", timeoutMs: 45000 },
  { label: "Titanium", query: "server=Titanium", timeoutMs: 45000 },
];
var playSession = 0;

function formatResolveError(play) {
  if (play && play.warnings && play.warnings.length === 1) {
    return play.warnings[0];
  }
  return "No playable stream for this title right now.";
}

function formatPlaybackError(err) {
  var msg = err && err.message ? err.message : String(err);
  if (msg.indexOf("timed out") !== -1) {
    return "Stream lookup timed out. Could not find a playable source.";
  }
  return msg;
}

function isActivePlaySession(session) {
  return session === playSession;
}

function enterFullscreenPlayback() {
  var screen = document.getElementById("screen");
  if (screen) screen.innerHTML = "";
  if (document.body) {
    document.body.classList.add("is-playing", "is-playback-fullscreen");
  }
}

function exitFullscreenPlayback() {
  if (document.body) {
    document.body.classList.remove("is-playback-fullscreen");
  }
}

function beginPlaybackRequest(title, onStatus) {
  playSession += 1;
  var session = playSession;

  var video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (video) player.destroyPlayer(video);

  enterFullscreenPlayback();

  if (wrap) {
    wrap.classList.remove("hidden");
    player.showPlaybackChrome(wrap, title || "");
  }

  debug.debugClear();
  debug.debugLog("Resolving: " + (title || ""));
  if (onStatus) onStatus("Resolving...");

  return session;
}

function resolveWithTizenFallback(resolveAttempts, onStatus, session) {
  var chain = Promise.resolve(null);
  for (var i = 0; i < resolveAttempts.length; i++) {
    (function (entry) {
      chain = chain.then(function (prev) {
        if (!isActivePlaySession(session)) return prev;
        if (prev && api.hasPlayableSources(prev)) return prev;
        var msg = "Trying " + entry.label + "…";
        debug.debugLog(msg);
        if (onStatus) onStatus(msg);
        return entry.run().catch(function (err) {
          debug.debugLog("Resolve failed (" + entry.label + "): " + err.message);
          return null;
        });
      });
    })(resolveAttempts[i]);
  }
  return chain;
}

function playResolved(play, title, onStatus, session) {
  if (!isActivePlaySession(session)) return Promise.resolve();

  var video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (!video || !wrap) return Promise.reject(new Error("Video element missing"));

  var sources = api.sourcesForPlay(play);
  if (!sources.length) {
    return Promise.reject(new Error(formatResolveError(play)));
  }

  wrap.classList.remove("hidden");
  player.showPlaybackChrome(wrap, title || play.title || "");
  debug.debugClear();
  debug.debugLog("Playing: " + (title || play.title || ""));

  function log(msg) {
    debug.debugLog(msg);
    if (onStatus) onStatus(msg);
  }

  player.playSources(video, sources, log, wrap, title || play.title || "Playback");
  return Promise.resolve();
}

function buildMovieResolveChain(tmdbId) {
  var attempts = [];

  if (player.isTizenTv()) {
    for (var i = 0; i < TIZEN_SERVER_FALLBACKS.length; i++) {
      (function (fb) {
        attempts.push({
          label: fb.label,
          run: function () {
            return api.resolveMovie(tmdbId, fb.query, fb.timeoutMs);
          },
        });
      })(TIZEN_SERVER_FALLBACKS[i]);
    }
  }

  attempts.push({
    label: "all providers",
    run: function () {
      return api.resolveMovie(tmdbId, null, config.PLAY_RESOLVE_TIMEOUT_MS);
    },
  });

  return attempts;
}

function buildTvResolveChain(tmdbId, season, episode) {
  var attempts = [];

  if (player.isTizenTv()) {
    for (var i = 0; i < TIZEN_SERVER_FALLBACKS.length; i++) {
      (function (fb) {
        attempts.push({
          label: fb.label,
          run: function () {
            return api.resolveTvEpisode(tmdbId, season, episode, fb.query, fb.timeoutMs);
          },
        });
      })(TIZEN_SERVER_FALLBACKS[i]);
    }
  }

  attempts.push({
    label: "all providers",
    run: function () {
      return api.resolveTvEpisode(tmdbId, season, episode, null, config.PLAY_RESOLVE_TIMEOUT_MS);
    },
  });

  return attempts;
}

function handlePlaybackFailure(session, err) {
  if (!isActivePlaySession(session)) return;
  debug.debugLog("Playback failed: " + (err && err.message ? err.message : String(err)));
  player.exitPlaybackMode();
  exitFullscreenPlayback();
  var wrap = document.getElementById("videoWrap");
  if (wrap) wrap.classList.add("hidden");
  var router = require("../core/router.js");
  router.rerender();
  throw new Error(formatPlaybackError(err));
}

function playMovie(tmdbId, title, onStatus) {
  var session = beginPlaybackRequest(title, onStatus);
  return resolveWithTizenFallback(buildMovieResolveChain(tmdbId), onStatus, session)
    .then(function (play) {
      if (!isActivePlaySession(session)) return;
      if (!play || !api.hasPlayableSources(play)) {
        return Promise.reject(new Error(formatResolveError(play)));
      }
      return playResolved(play, title, onStatus, session);
    })
    .catch(function (err) {
      return handlePlaybackFailure(session, err);
    });
}

function playTvEpisode(tmdbId, season, episode, title, onStatus) {
  var session = beginPlaybackRequest(title, onStatus);
  return resolveWithTizenFallback(buildTvResolveChain(tmdbId, season, episode), onStatus, session)
    .then(function (play) {
      if (!isActivePlaySession(session)) return;
      if (!play || !api.hasPlayableSources(play)) {
        return Promise.reject(new Error(formatResolveError(play)));
      }
      return playResolved(play, title, onStatus, session);
    })
    .catch(function (err) {
      return handlePlaybackFailure(session, err);
    });
}

function stop(options) {
  options = options || {};
  playSession += 1;
  var wasFullscreen =
    document.body &&
    document.body.classList.contains("is-playback-fullscreen");

  var video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (video) {
    player.destroyPlayer(video);
    video.removeAttribute("controls");
    video.removeAttribute("crossorigin");
  }
  player.exitPlaybackMode();
  exitFullscreenPlayback();
  if (wrap) wrap.classList.add("hidden");

  if (wasFullscreen && !options.skipRerender) {
    var router = require("../core/router.js");
    router.rerender();
  }
}

module.exports = {
  playResolved: playResolved,
  playMovie: playMovie,
  playTvEpisode: playTvEpisode,
  stop: stop,
};
