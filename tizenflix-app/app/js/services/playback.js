/**
 * Start playback from any screen — shared by home, detail, etc.
 */

var api = require("./api.js");
var config = require("../core/config.js");
var player = require("../player/player.js");
var debug = require("../core/debug.js");
var playbackSession = require("./playback-session.js");
var playerChrome = require("../components/player-chrome.js");

/** Vidking-only fallbacks when TMDB-native returns nothing playable. */
var VIDKING_SERVER_FALLBACKS = [
  { label: "Oxygen", query: "server=Oxygen&backend=vidking", timeoutMs: 15000 },
  { label: "Titanium", query: "server=Titanium&backend=vidking", timeoutMs: 15000 },
];
var FAST_RESOLVE_QUERY = "onlySourceId=vixsrc&backend=tmdb-native";
var FAST_RESOLVE_TIMEOUT_MS = 8000;
var playSession = 0;
var progressSaveTimer = null;
var lastProgressSaveAt = 0;
var PROGRESS_SAVE_INTERVAL_MS = 30000;
var autoplayTimer = null;
var autoplayEndedHandler = null;

function clearAutoplayTimer() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

function unbindAutoplayHandler() {
  clearAutoplayTimer();
  var video = document.getElementById("video");
  if (video && autoplayEndedHandler) {
    video.removeEventListener("ended", autoplayEndedHandler);
  }
  autoplayEndedHandler = null;
}

function bindAutoplayHandler(video, onStatus) {
  unbindAutoplayHandler();
  if (!video || !config.getAutoplayNext()) return;

  autoplayEndedHandler = function () {
    var session = playbackSession.get();
    if (!session || session.type !== "tv" || !session.nextEpisode) return;
    var bufferSec = config.getAutoplayBufferSec();
    var remaining = bufferSec;
    if (onStatus) onStatus("Next episode in " + remaining + "s…");
    clearAutoplayTimer();
    autoplayTimer = setInterval(function () {
      remaining -= 1;
      if (remaining > 0) {
        if (onStatus) onStatus("Next episode in " + remaining + "s…");
        return;
      }
      clearAutoplayTimer();
      var handlers = buildChromeHandlers(onStatus);
      if (handlers.onNextEpisode) handlers.onNextEpisode();
    }, 1000);
  };
  video.addEventListener("ended", autoplayEndedHandler);
}

function buildProgressPayload(video) {
  var session = playbackSession.get();
  if (!session || !session.tmdbId) return null;
  var duration = video && video.duration && isFinite(video.duration) ? video.duration : 0;
  var position = video && video.currentTime ? video.currentTime : 0;
  if (duration <= 0 || position <= 0) return null;

  var poster = null;
  if (session.play && session.play.poster) poster = session.play.poster;

  return {
    tmdbId: String(session.tmdbId),
    type: session.type || "movie",
    season: session.type === "tv" ? session.season : undefined,
    episode: session.type === "tv" ? session.episode : undefined,
    title: session.showTitle || session.title || "",
    poster: poster,
    positionSeconds: Math.floor(position),
    durationSeconds: Math.floor(duration),
  };
}

function savePlaybackProgress(video, force) {
  if (!video) return;
  var payload = buildProgressPayload(video);
  if (!payload) return;

  var now = Date.now();
  if (!force && now - lastProgressSaveAt < PROGRESS_SAVE_INTERVAL_MS) return;
  lastProgressSaveAt = now;

  api.saveProgress(payload).catch(function () {
    /* non-fatal */
  });
}

function bindProgressSaver(video) {
  unbindProgressSaver();
  if (!video) return;

  progressSaveTimer = function () {
    savePlaybackProgress(video, false);
  };
  video.addEventListener("timeupdate", progressSaveTimer);
}

function unbindProgressSaver() {
  var video = document.getElementById("video");
  if (video && progressSaveTimer) {
    video.removeEventListener("timeupdate", progressSaveTimer);
  }
  progressSaveTimer = null;
  lastProgressSaveAt = 0;
}

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

function buildChromeHandlers(onStatus) {
  var video = document.getElementById("video");

  function log(msg) {
    debug.debugLog(msg);
    if (onStatus) onStatus(msg);
  }

  return {
    onFocusChange: function (label) {
      if (window.TizenflixApp && window.TizenflixApp.updateFocusHint) {
        window.TizenflixApp.updateFocusHint(label);
      }
    },
    onBack: function () {
      handleBackKey();
    },
    onStop: function () {
      stop();
    },
    onSeek: function (delta) {
      player.seekBy(video, delta);
      playerChrome.updateProgress(video);
    },
    onPlayPause: function () {
      player.togglePlayPause(video, log);
      playerChrome.updatePlayPauseIcon(video);
    },
    onSubtitleSelect: function (index) {
      player.selectSubtitle(video, index);
      playbackSession.update({ activeSubtitleIndex: index });
    },
    onSourceSwitch: function (index) {
      switchSource(index, onStatus).catch(function (err) {
        log(err.message);
      });
    },
    onQualitySelect: function (mode) {
      config.setQualityMode(mode);
      player.applyQualityMode(player.getHlsInstance(), mode);
      log("Quality: " + mode);
    },
    onSpeedCycle: function () {
      var next = config.cyclePlaybackSpeed();
      video.playbackRate = next;
      log("Speed: " + next + "x");
    },
    onReResolve: function (overrides) {
      reResolveWith(overrides, onStatus).catch(function (err) {
        log(err.message);
      });
    },
    onEpisodeSelect: function (tmdbId, season, episode, episodeTitle, overview) {
      var session = playbackSession.get();
      var showTitle = session ? session.showTitle : "";
      var label = showTitle + " S" + season + "E" + episode;
      playTvEpisode(
        tmdbId,
        season,
        episode,
        label,
        onStatus,
        {
          showTitle: showTitle,
          episodeTitle: episodeTitle,
          overview: overview,
          metaLine: session ? session.metaLine : "",
        }
      ).catch(function (err) {
        log(err.message);
      });
    },
    onNextEpisode: function () {
      var session = playbackSession.get();
      if (!session || !session.nextEpisode) return;
      var next = session.nextEpisode;
      var season = parseInt(next.season, 10);
      var episode = parseInt(next.episode, 10);
      var showTitle = session.showTitle || session.title || "";
      playTvEpisode(
        session.tmdbId,
        season,
        episode,
        showTitle + " S" + season + "E" + episode,
        onStatus,
        { showTitle: showTitle, metaLine: session.metaLine }
      ).catch(function (err) {
        log(err.message);
      });
    },
  };
}

function mountChrome(session, onStatus) {
  playerChrome.mount(session, buildChromeHandlers(onStatus));
}

function beginPlaybackRequest(meta, onStatus) {
  playSession += 1;
  var session = playSession;

  var video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (video) player.destroyPlayer(video);

  playbackSession.create(meta);
  enterFullscreenPlayback();

  if (wrap) {
    wrap.classList.remove("hidden");
    player.showPlaybackChrome(wrap, meta.displayTitle || meta.title || "");
  }

  mountChrome(playbackSession.get(), onStatus);

  debug.debugClear();
  debug.debugLog("Resolving: " + (meta.displayTitle || meta.title || ""));
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

function playResolved(play, title, onStatus, session, playOptions) {
  playOptions = playOptions || {};
  if (!isActivePlaySession(session)) return Promise.resolve();

  var video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (!video || !wrap) return Promise.reject(new Error("Video element missing"));

  var sources = api.sourcesForPlay(play);
  if (!sources.length) {
    return Promise.reject(new Error(formatResolveError(play)));
  }

  playbackSession.setFromPlay(play, sources, { displayTitle: title });
  var stored = playbackSession.get();

  wrap.classList.remove("hidden");
  player.showPlaybackChrome(wrap, title || play.title || "");
  player.applySubtitles(video, play.subtitles || []);
  loadSubtitlesAsync(play, video);
  mountChrome(stored, onStatus);
  bindProgressSaver(video);
  video.playbackRate = config.getPlaybackSpeed();
  bindAutoplayHandler(video, onStatus);

  debug.debugClear();
  debug.debugLog("Playing: " + (title || play.title || ""));

  function log(msg) {
    debug.debugLog(msg);
    if (onStatus) onStatus(msg);
  }

  var sourceOptions = {};
  if (playOptions.startSeconds > 0) {
    sourceOptions.startSeconds = playOptions.startSeconds;
  }
  var warmed = playbackSession.getWarmedManifest();
  if (warmed && sources[0] && sources[0].url === warmed) {
    sourceOptions.warmedManifestUrl = warmed;
  }
  player.playSources(video, sources, log, wrap, title || play.title || "Playback", sourceOptions);
  return Promise.resolve();
}

function loadSubtitlesAsync(play, video) {
  if (!play || !play.tmdbId) return;
  var promise;
  if (play.type === "tv") {
    promise = api.fetchPlaySubtitlesTv(play.tmdbId, play.season, play.episode);
  } else {
    promise = api.fetchPlaySubtitlesMovie(play.tmdbId);
  }
  promise
    .then(function (data) {
      if (!data || !data.subtitles || !data.subtitles.length) return;
      player.applySubtitles(video, data.subtitles);
      playbackSession.update({ subtitles: data.subtitles });
    })
    .catch(function () {
      /* non-fatal */
    });
}

function buildMovieResolveChain(tmdbId) {
  var attempts = [
    {
      label: "VixSrc (fast)",
      run: function () {
        return api.resolveMovie(tmdbId, FAST_RESOLVE_QUERY, FAST_RESOLVE_TIMEOUT_MS);
      },
    },
    {
      label: "Auto",
      run: function () {
        return api.resolveMovie(tmdbId, "backend=auto", config.PLAY_RESOLVE_TIMEOUT_MS);
      },
    },
  ];

  for (var i = 0; i < VIDKING_SERVER_FALLBACKS.length; i++) {
    (function (fb) {
      attempts.push({
        label: fb.label,
        run: function () {
          return api.resolveMovie(tmdbId, fb.query, fb.timeoutMs);
        },
      });
    })(VIDKING_SERVER_FALLBACKS[i]);
  }

  return attempts;
}

function buildTvResolveChain(tmdbId, season, episode) {
  var attempts = [
    {
      label: "VixSrc (fast)",
      run: function () {
        return api.resolveTvEpisode(
          tmdbId,
          season,
          episode,
          FAST_RESOLVE_QUERY,
          FAST_RESOLVE_TIMEOUT_MS
        );
      },
    },
    {
      label: "Auto",
      run: function () {
        return api.resolveTvEpisode(
          tmdbId,
          season,
          episode,
          "backend=auto",
          config.PLAY_RESOLVE_TIMEOUT_MS
        );
      },
    },
  ];

  for (var i = 0; i < VIDKING_SERVER_FALLBACKS.length; i++) {
    (function (fb) {
      attempts.push({
        label: fb.label,
        run: function () {
          return api.resolveTvEpisode(tmdbId, season, episode, fb.query, fb.timeoutMs);
        },
      });
    })(VIDKING_SERVER_FALLBACKS[i]);
  }

  return attempts;
}

function buildReResolveQuery(overrides) {
  overrides = overrides || {};
  var parts = [];
  if (overrides.server) {
    parts.push("server=" + encodeURIComponent(overrides.server));
    parts.push("backend=vidking");
  } else if (overrides.onlySourceId) {
    parts.push("onlySourceId=" + encodeURIComponent(overrides.onlySourceId));
    parts.push("backend=tmdb-native");
  }
  if (overrides.backend && !overrides.server) {
    parts.push("backend=" + encodeURIComponent(overrides.backend));
  }
  return parts.join("&");
}

function handlePlaybackFailure(session, err) {
  if (!isActivePlaySession(session)) return;
  debug.debugLog("Playback failed: " + (err && err.message ? err.message : String(err)));
  playerChrome.destroy();
  playbackSession.clear();
  player.exitPlaybackMode();
  exitFullscreenPlayback();
  var wrap = document.getElementById("videoWrap");
  if (wrap) wrap.classList.add("hidden");
  var router = require("../core/router.js");
  router.rerender();
  throw new Error(formatPlaybackError(err));
}

function resolvePlayback(tmdbId, type, season, episode, onStatus, session) {
  var key =
    type === "tv"
      ? playbackSession.prefetchKey("tv", tmdbId, season, episode)
      : playbackSession.prefetchKey("movie", tmdbId);
  var prefetched = playbackSession.getPrefetch(key);
  if (prefetched && api.hasPlayableSources(prefetched)) {
    debug.debugLog("Using prefetched resolve");
    if (onStatus) onStatus("Starting playback…");
    return Promise.resolve(prefetched);
  }

  var chain =
    type === "tv"
      ? buildTvResolveChain(tmdbId, season, episode)
      : buildMovieResolveChain(tmdbId);
  return resolveWithTizenFallback(chain, onStatus, session);
}

function warmManifestFromPlay(play) {
  var sources = api.sourcesForPlay(play);
  if (!sources.length || !sources[0].url) return;
  var manifestUrl = sources[0].url;
  api.warmStreamUrl(manifestUrl).then(function () {
    playbackSession.setWarmedManifest(manifestUrl);
    debug.debugLog("Manifest warmed: " + manifestUrl.slice(0, 80));
  }).catch(function () {
    /* non-fatal */
  });
}

function prefetchMovie(tmdbId) {
  api
    .resolveMovie(tmdbId, FAST_RESOLVE_QUERY, FAST_RESOLVE_TIMEOUT_MS)
    .then(function (play) {
      if (play && api.hasPlayableSources(play)) {
        playbackSession.setPrefetch(playbackSession.prefetchKey("movie", tmdbId), play);
        warmManifestFromPlay(play);
      }
    })
    .catch(function () {
      /* non-fatal */
    });
}

function prefetchTvEpisode(tmdbId, season, episode) {
  api
    .resolveTvEpisode(tmdbId, season, episode, FAST_RESOLVE_QUERY, FAST_RESOLVE_TIMEOUT_MS)
    .then(function (play) {
      if (play && api.hasPlayableSources(play)) {
        playbackSession.setPrefetch(
          playbackSession.prefetchKey("tv", tmdbId, season, episode),
          play
        );
        warmManifestFromPlay(play);
      }
    })
    .catch(function () {
      /* non-fatal */
    });
}

function playMovie(tmdbId, title, onStatus, meta) {
  meta = meta || {};
  var startSeconds = meta.startSeconds || 0;
  var sessionMeta = {
    tmdbId: tmdbId,
    type: "movie",
    title: title,
    displayTitle: title,
    showTitle: title,
  };
  for (var k in meta) {
    if (Object.prototype.hasOwnProperty.call(meta, k)) sessionMeta[k] = meta[k];
  }
  var session = beginPlaybackRequest(sessionMeta, onStatus);
  return resolvePlayback(tmdbId, "movie", null, null, onStatus, session)
    .then(function (play) {
      if (!isActivePlaySession(session)) return;
      if (!play || !api.hasPlayableSources(play)) {
        return Promise.reject(new Error(formatResolveError(play)));
      }
      return playResolved(play, title, onStatus, session, { startSeconds: startSeconds });
    })
    .catch(function (err) {
      return handlePlaybackFailure(session, err);
    });
}

function playTvEpisode(tmdbId, season, episode, title, onStatus, meta) {
  meta = meta || {};
  var startSeconds = meta.startSeconds || 0;
  var sessionMeta = {
    tmdbId: tmdbId,
    type: "tv",
    season: season,
    episode: episode,
    title: title,
    displayTitle: title,
    showTitle: meta.showTitle || title,
    episodeTitle: meta.episodeTitle || "",
    overview: meta.overview || "",
    metaLine: meta.metaLine || "",
  };
  for (var k in meta) {
    if (Object.prototype.hasOwnProperty.call(meta, k)) sessionMeta[k] = meta[k];
  }
  var session = beginPlaybackRequest(sessionMeta, onStatus);
  return resolvePlayback(tmdbId, "tv", season, episode, onStatus, session)
    .then(function (play) {
      if (!isActivePlaySession(session)) return;
      if (!play || !api.hasPlayableSources(play)) {
        return Promise.reject(new Error(formatResolveError(play)));
      }
      return playResolved(play, title, onStatus, session, { startSeconds: startSeconds });
    })
    .catch(function (err) {
      return handlePlaybackFailure(session, err);
    });
}

function switchSource(index, onStatus) {
  var stored = playbackSession.get();
  if (!stored || !stored.sources.length) {
    return Promise.reject(new Error("No sources available"));
  }
  if (index < 0 || index >= stored.sources.length) {
    return Promise.reject(new Error("Invalid source"));
  }

  var video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (!video || !wrap) return Promise.reject(new Error("Video element missing"));

  player.destroyPlayer(video);
  stored.currentSourceIndex = index;
  var remaining = stored.sources.slice(index);

  function log(msg) {
    debug.debugLog(msg);
    if (onStatus) onStatus(msg);
  }

  player.playSources(video, remaining, log, wrap, stored.displayTitle || "Playback");
  return Promise.resolve();
}

function reResolveWith(overrides, onStatus) {
  var stored = playbackSession.get();
  if (!stored) return Promise.reject(new Error("No active playback"));

  var query = buildReResolveQuery(overrides);
  if (!query) return Promise.reject(new Error("Nothing to switch"));

  var video = document.getElementById("video");
  if (video) player.destroyPlayer(video);

  if (onStatus) onStatus("Switching server…");
  debug.debugLog("Re-resolving: " + query);

  var resolvePromise;
  if (stored.type === "tv") {
    resolvePromise = api.resolveTvEpisode(
      stored.tmdbId,
      stored.season,
      stored.episode,
      query,
      config.PLAY_RESOLVE_TIMEOUT_MS
    );
  } else {
    resolvePromise = api.resolveMovie(stored.tmdbId, query, config.PLAY_RESOLVE_TIMEOUT_MS);
  }

  return resolvePromise.then(function (play) {
    if (!play || !api.hasPlayableSources(play)) {
      return Promise.reject(new Error(formatResolveError(play)));
    }
    return playResolved(play, stored.displayTitle, onStatus, playSession);
  });
}

function handleBackKey() {
  if (playerChrome.handleBack()) return true;
  stop();
  return true;
}

function stop(options) {
  options = options || {};
  var video = document.getElementById("video");
  if (video) savePlaybackProgress(video, true);
  unbindProgressSaver();
  unbindAutoplayHandler();

  playSession += 1;
  var wasFullscreen =
    document.body &&
    document.body.classList.contains("is-playback-fullscreen");

  playerChrome.destroy();
  playbackSession.clear();

  video = document.getElementById("video");
  var wrap = document.getElementById("videoWrap");
  if (video) {
    video._playerChromeBound = false;
    player.destroyPlayer(video);
    video.removeAttribute("controls");
    video.removeAttribute("crossorigin");
  }
  player.exitPlaybackMode();
  exitFullscreenPlayback();
  if (wrap) wrap.classList.add("hidden");

  if (wasFullscreen && !options.skipRerender) {
    var router = require("../core/router.js");
    router.rerenderWithSidebarFocus();
  }
}

function getSession() {
  return playbackSession.get();
}

module.exports = {
  playResolved: playResolved,
  playMovie: playMovie,
  playTvEpisode: playTvEpisode,
  prefetchMovie: prefetchMovie,
  prefetchTvEpisode: prefetchTvEpisode,
  stop: stop,
  getSession: getSession,
  switchSource: switchSource,
  reResolveWith: reResolveWith,
  handleBackKey: handleBackKey,
};
