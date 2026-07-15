/**
 * Start playback from any screen — shared by home, detail, etc.
 */

var api = require("./api.js");
var config = require("../core/config.js");
var player = require("../player/player.js");
var debug = require("../core/debug.js");
var playbackSession = require("./playback-session.js");
var playerChrome = require("../components/player-chrome.js");

/** Videasy CDN order — aligns with API VIDEASY_TIZEN_SERVER_PRIORITY. */
var VIDEASY_SERVER_FALLBACKS = [
  { label: "Neon", query: "server=Neon&backend=videasy", timeoutMs: 15000 },
  { label: "Yoru", query: "server=Yoru&backend=videasy", timeoutMs: 15000 },
  { label: "Tejo", query: "server=Tejo&backend=videasy", timeoutMs: 15000 },
  { label: "Sage", query: "server=Sage&backend=videasy", timeoutMs: 15000 },
  { label: "Cypher", query: "server=Cypher&backend=videasy", timeoutMs: 15000 },
];
var VIDEASY_SERVER_NAMES = ["Neon", "Yoru", "Tejo", "Sage", "Cypher", "Vyse", "Breach", "Jett", "Killjoy"];
/** Vidking CDN order — last-resort fallback. */
var VIDKING_SERVER_FALLBACKS = [
  { label: "Oxygen", query: "server=Oxygen&backend=vidking", timeoutMs: 15000 },
  { label: "Titanium", query: "server=Titanium&backend=vidking", timeoutMs: 15000 },
  { label: "Helium", query: "server=Helium&backend=vidking", timeoutMs: 15000 },
  { label: "Hydrogen", query: "server=Hydrogen&backend=vidking", timeoutMs: 15000 },
  { label: "Lithium", query: "server=Lithium&backend=vidking", timeoutMs: 15000 },
];
var VIDKING_SERVER_NAMES = ["Oxygen", "Titanium", "Helium", "Hydrogen", "Lithium"];
var PRIMARY_RESOLVE_TIMEOUT_MS = 90000;
var ANIME_PROVIDER_ORDER = ["hianime", "anikoto", "ani-world", "anime-world"];
var EN_PROVIDER_ORDER = ["sflix", "ridomovies", "superstream", "streaming-community-en", "anymovie"];
var TMDB_BACKUP_QUERY = "backend=tmdb-native&sources=twoembed,vidrock,vidsrcnet,vidzee";
var VIXSRC_QUERY = "backend=tmdb-native&sources=vixsrc";
var playSession = 0;
var progressSaveTimer = null;
var lastProgressSaveAt = 0;
var PROGRESS_SAVE_INTERVAL_MS = 30000;
var autoplayTimer = null;
var autoplayEndedHandler = null;
var qualityUnsubscribe = null;
var lastKnownPlayingHeight = 0;
var qualityUpgradeAttempted = false;
var pendingQualityUpgrade = null;
var QUALITY_RACE_GRACE_MS = 2000;

function unbindQualityWatcher() {
  if (qualityUnsubscribe) {
    qualityUnsubscribe();
    qualityUnsubscribe = null;
  }
}

function bindQualityWatcher() {
  unbindQualityWatcher();
  var video = document.getElementById("video");
  qualityUnsubscribe = player.onQualityChange(function (info) {
    if (info.height) lastKnownPlayingHeight = info.height;
    playerChrome.updateQualityBadge(info);
    if (!pendingQualityUpgrade || qualityUpgradeAttempted) return;
    var targetPx = config.targetResolutionPixels(config.getTargetResolution());
    if (targetPx && info.height > 0 && info.height < targetPx) {
      var pending = pendingQualityUpgrade;
      pendingQualityUpgrade = null;
      scheduleQualityUpgrade(
        pending.session,
        pending.play,
        pending.title,
        pending.onStatus,
        pending.playOptions
      );
    }
  });
  playerChrome.updateQualityBadge(player.getCurrentQuality(player.getHlsInstance(), video));
}

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

  var poster = session.poster || (session.play && session.play.poster) || null;

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
  if (play && play.warnings && play.warnings.length) {
    if (play.warnings.length === 1) return play.warnings[0];
    return play.warnings.slice(0, 3).join("; ");
  }
  return "No playable stream for this title right now.";
}

function formatPlaybackError(err) {
  var msg = err && err.message ? err.message : String(err);
  if (msg.indexOf("Cannot reach API") !== -1) return msg;
  if (msg.indexOf("Failed to fetch") !== -1 || msg.indexOf("NetworkError") !== -1) {
    return (
      "Cannot reach API at " +
      api.getBase() +
      ". Open Settings, set API URL to your PC's LAN address (port 8790), and ensure tizenflix-api is running."
    );
  }
  if (msg.indexOf("timed out") !== -1) {
    return "Stream lookup timed out. Could not find a playable source.";
  }
  return msg;
}

function ensureApiReachable() {
  var base = api.getBase();
  debug.debugLog("API: " + base);
  return api.health().catch(function () {
    throw new Error(
      "Cannot reach API at " +
        base +
        ". Open Settings, set API URL to your PC's LAN address (port 8790), and ensure tizenflix-api is running."
    );
  });
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
    onQualitySelect: function (level) {
      var hls = player.getHlsInstance();
      var video = document.getElementById("video");
      if (level < 0) {
        config.setQualityAuto();
        if (hls) {
          player.setQualityLevel(hls, -1);
        } else {
          playerChrome.updateQualityBadge(player.getCurrentQuality(null, video));
        }
        log("Quality: Auto");
        return;
      }
      config.setQualityLevel(level);
      if (hls) {
        player.setQualityLevel(hls, level);
        var info = player.getCurrentQuality(hls, video);
        log("Quality: " + (info.label || level));
        return;
      }
      var stored = playbackSession.get();
      if (!stored || !stored.sources.length) {
        log("Quality: stream not ready");
        return;
      }
      if (video && video.currentTime > 0) {
        player.setResumePosition(video.currentTime);
      }
      var sourceIndex = stored.currentSourceIndex || 0;
      switchSource(sourceIndex, onStatus)
        .then(function () {
          var newHls = player.getHlsInstance();
          if (newHls) player.setQualityLevel(newHls, level);
        })
        .catch(function (err) {
          log(err.message);
        });
      log("Quality: switching to level " + level);
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
      if (
        session &&
        String(session.season) === String(season) &&
        String(session.episode) === String(episode)
      ) {
        return;
      }
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
  bindQualityWatcher();
}

function beginPlaybackRequest(meta, onStatus) {
  playSession += 1;
  var session = playSession;
  qualityUpgradeAttempted = false;
  lastKnownPlayingHeight = 0;
  pendingQualityUpgrade = null;

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

function isCdnPlaybackError(reason) {
  if (!reason) return false;
  return /HTTP (521|502|503|403|404)|manifestLoadError|networkError/i.test(String(reason));
}

function countPlayableSources(play) {
  return api.sourcesForPlay(play).length;
}

function pickBestResolveResult(results) {
  var target = config.getTargetResolution();
  var best = null;
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!r.play || !api.hasPlayableSources(r.play)) continue;
    var count = countPlayableSources(r.play);
    var height = config.maxSourceHeight(r.play);
    if (!best) {
      best = {
        play: r.play,
        via: r.via,
        tierIndex: r.tierIndex,
        count: count,
        height: height,
      };
      continue;
    }
    if (target !== "auto") {
      var scoreA = config.qualityHeightScore(height, target);
      var scoreB = config.qualityHeightScore(best.height, target);
      if (scoreA !== scoreB) {
        if (scoreA > scoreB) {
          best = {
            play: r.play,
            via: r.via,
            tierIndex: r.tierIndex,
            count: count,
            height: height,
          };
        }
        continue;
      }
      if (height > best.height) {
        best = {
          play: r.play,
          via: r.via,
          tierIndex: r.tierIndex,
          count: count,
          height: height,
        };
        continue;
      }
    }
    if (
      count > best.count ||
      (count === best.count && r.tierIndex < best.tierIndex)
    ) {
      best = {
        play: r.play,
        via: r.via,
        tierIndex: r.tierIndex,
        count: count,
        height: height,
      };
    }
  }
  return best;
}

/** Race primary resolve attempts in parallel; pick the richest playable result. */
function raceResolveAttempts(resolveAttempts, onStatus, session) {
  if (!resolveAttempts.length) {
    return Promise.resolve({ play: null, via: null, tierIndex: -1, fallbacks: [] });
  }

  debug.debugLog("Racing: " + resolveAttempts.map(function (e) { return e.label; }).join(", "));
  if (onStatus) onStatus("Finding stream…");

  var targetAuto = config.getTargetResolution() === "auto";

  return new Promise(function (resolve) {
    var finished = false;
    var pending = resolveAttempts.length;
    var results = [];
    var firstSuccessAt = 0;
    var graceTimer = null;

    function finish() {
      if (finished) return;
      finished = true;
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
      var best = pickBestResolveResult(results);
      if (best) {
        debug.debugLog("Resolved via: " + best.via + " (" + best.count + " source(s))");
        if (onStatus) onStatus("Resolved via: " + best.via);
        resolve({
          play: best.play,
          via: best.via,
          tierIndex: best.tierIndex,
          fallbacks: resolveAttempts.slice(best.tierIndex + 1),
        });
        return;
      }
      resolve({
        play: null,
        via: null,
        tierIndex: -1,
        fallbacks: resolveAttempts,
      });
    }

    function noteSuccess() {
      if (!firstSuccessAt) firstSuccessAt = Date.now();
      if (targetAuto) {
        finish();
        return;
      }
      if (pending === 0) {
        finish();
        return;
      }
      if (!graceTimer) {
        graceTimer = setTimeout(function () {
          graceTimer = null;
          finish();
        }, QUALITY_RACE_GRACE_MS);
      }
    }

    for (var i = 0; i < resolveAttempts.length; i++) {
      (function (entry, tierIndex) {
        debug.debugLog("Trying " + entry.label + "…");
        entry
          .run()
          .then(function (play) {
            if (!isActivePlaySession(session) || finished) return;
            if (play && api.hasPlayableSources(play)) {
              results.push({
                play: play,
                via: entry.label,
                tierIndex: tierIndex,
                count: countPlayableSources(play),
              });
              noteSuccess();
            }
          })
          .catch(function (err) {
            debug.debugLog("Resolve failed (" + entry.label + "): " + err.message);
          })
          .then(function () {
            pending -= 1;
            if (pending === 0) finish();
          });
      })(resolveAttempts[i], i);
    }
  });
}

function resolveWithTizenFallback(resolveAttempts, onStatus, session) {
  var chain = Promise.resolve({ play: null, via: null, tierIndex: -1 });
  for (var i = 0; i < resolveAttempts.length; i++) {
    (function (entry, tierIndex) {
      chain = chain.then(function (prev) {
        if (!isActivePlaySession(session)) return prev;
        if (prev.play && api.hasPlayableSources(prev.play)) return prev;
        var msg = "Trying " + entry.label + "…";
        debug.debugLog(msg);
        if (onStatus) onStatus(msg);
        return entry
          .run()
          .then(function (play) {
            if (play && api.hasPlayableSources(play)) {
              return { play: play, via: entry.label, tierIndex: tierIndex };
            }
            return prev;
          })
          .catch(function (err) {
            debug.debugLog("Resolve failed (" + entry.label + "): " + err.message);
            return prev;
          });
      });
    })(resolveAttempts[i], i);
  }
  return chain.then(function (result) {
    if (result.via && result.play) {
      debug.debugLog("Resolved via: " + result.via);
      if (onStatus) onStatus("Resolved via: " + result.via);
    }
    var fallbacks =
      result.tierIndex >= 0 ? resolveAttempts.slice(result.tierIndex + 1) : resolveAttempts;
    return { play: result.play, via: result.via, fallbacks: fallbacks };
  });
}

function escalatePlaybackFallback(fallbacks, title, onStatus, session, playOptions) {
  if (!isActivePlaySession(session)) return Promise.resolve();
  if (!fallbacks || !fallbacks.length) {
    return Promise.reject(new Error("All sources failed — CDN may be blocking playback"));
  }

  playbackSession.clearPrefetch();

  var msg = "CDN error — trying next server…";
  debug.debugLog(msg);
  if (onStatus) onStatus(msg);

  return resolveWithTizenFallback(fallbacks, onStatus, session).then(function (result) {
    if (!isActivePlaySession(session)) return;
    if (!result.play || !api.hasPlayableSources(result.play)) {
      return Promise.reject(new Error(formatResolveError(result.play)));
    }
    if (result.via && result.play.sources && result.play.sources[0]) {
      config.setPreferredProviderId(result.play.sources[0].providerId || null);
    }
    playOptions._fallbacks = result.fallbacks || [];
    return playResolved(result.play, title, onStatus, session, playOptions);
  });
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

  if (sources[0] && sources[0].providerId) {
    config.setPreferredProviderId(sources[0].providerId);
  }

  wrap.classList.remove("hidden");
  player.showPlaybackChrome(wrap, title || play.title || "");
  player.applySubtitles(video, play.subtitles || []);
  loadSubtitlesAsync(play, video);
  mountChrome(stored, onStatus);
  bindProgressSaver(video);
  video.playbackRate = config.getPlaybackSpeed();
  bindAutoplayHandler(video, onStatus);

  debug.debugLog("Playing: " + (title || play.title || ""));

  if (play.warnings && play.warnings.length) {
    for (var w = 0; w < play.warnings.length; w++) {
      if (onStatus) onStatus(play.warnings[w]);
      else debug.debugLog(play.warnings[w]);
    }
  }

  function log(msg) {
    if (onStatus) onStatus(msg);
    else debug.debugLog(msg);
  }

  var sourceOptions = {};
  if (playOptions.startSeconds > 0) {
    sourceOptions.startSeconds = playOptions.startSeconds;
  }
  var warmed = playbackSession.getWarmedManifest();
  if (warmed && sources[0] && sources[0].url === warmed) {
    sourceOptions.warmedManifestUrl = warmed;
  }
  if (playOptions._fallbacks && playOptions._fallbacks.length) {
    var escalating = false;
    sourceOptions.onAllSourcesFailed = function (reason) {
      if (escalating || !playOptions._fallbacks || !playOptions._fallbacks.length) return;
      if (!isCdnPlaybackError(reason)) return;
      escalating = true;
      var nextFallbacks = playOptions._fallbacks;
      playOptions._fallbacks = [];
      escalatePlaybackFallback(nextFallbacks, title, onStatus, session, playOptions).catch(
        function (err) {
          escalating = false;
          log(err.message);
        }
      );
    };
  }
  player.playSources(video, sources, log, wrap, title || play.title || "Playback", sourceOptions);
  if (playOptions._upgradeAttempts && playOptions._upgradeAttempts.length) {
    pendingQualityUpgrade = {
      session: session,
      play: play,
      title: title,
      onStatus: onStatus,
      playOptions: playOptions,
    };
    setTimeout(function () {
      if (!pendingQualityUpgrade || pendingQualityUpgrade.session !== session) return;
      var pending = pendingQualityUpgrade;
      pendingQualityUpgrade = null;
      scheduleQualityUpgrade(
        pending.session,
        pending.play,
        pending.title,
        pending.onStatus,
        pending.playOptions
      );
    }, 5000);
  }
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

function buildPrimaryResolveQuery() {
  var parts = [];
  var backend = config.getPlayBackend();
  parts.push("backend=" + backend);
  var preferred = config.getPreferredProviderId();
  if (preferred) {
    parts.push("preferredProviderId=" + encodeURIComponent(preferred));
  }
  return parts.join("&");
}

function isVidkingProviderName(name) {
  if (!name) return false;
  var lower = String(name).toLowerCase();
  for (var i = 0; i < VIDKING_SERVER_NAMES.length; i++) {
    if (VIDKING_SERVER_NAMES[i].toLowerCase() === lower) return true;
  }
  return false;
}

function isVideasyProviderName(name) {
  if (!name) return false;
  var lower = String(name).toLowerCase();
  for (var i = 0; i < VIDEASY_SERVER_NAMES.length; i++) {
    if (VIDEASY_SERVER_NAMES[i].toLowerCase() === lower) return true;
  }
  return false;
}

function currentPlayProvider(play) {
  if (!play || !play.sources || !play.sources[0]) return null;
  var s = play.sources[0];
  return s.provider || s.providerId || null;
}

function isAnimeProviderId(providerId) {
  return providerId && ANIME_PROVIDER_ORDER.indexOf(providerId) !== -1;
}

function streamflixProviderChain(startAfterId) {
  var preferred = config.getPreferredProviderId();
  var anchor = startAfterId || preferred;
  if (anchor && isAnimeProviderId(anchor)) {
    var aIdx = ANIME_PROVIDER_ORDER.indexOf(anchor);
    return aIdx >= 0 ? ANIME_PROVIDER_ORDER.slice(aIdx + 1) : ANIME_PROVIDER_ORDER.slice();
  }
  if (anchor && EN_PROVIDER_ORDER.indexOf(anchor) !== -1) {
    var eIdx = EN_PROVIDER_ORDER.indexOf(anchor);
    return eIdx >= 0 ? EN_PROVIDER_ORDER.slice(eIdx + 1) : EN_PROVIDER_ORDER.slice();
  }
  return ANIME_PROVIDER_ORDER.concat(EN_PROVIDER_ORDER);
}

function buildStreamflixProviderFallbacks(tmdbId, type, season, episode, startAfterId) {
  var chain = streamflixProviderChain(startAfterId);
  var attempts = [];

  for (var i = 0; i < chain.length; i++) {
    (function (providerId) {
      attempts.push({
        label: providerId,
        run: function () {
          var q =
            "providerId=" + encodeURIComponent(providerId) + "&backend=streamflix";
          if (type === "tv") {
            return api.resolveTvEpisode(
              tmdbId,
              season,
              episode,
              q,
              PRIMARY_RESOLVE_TIMEOUT_MS
            );
          }
          return api.resolveMovie(tmdbId, q, PRIMARY_RESOLVE_TIMEOUT_MS);
        },
      });
    })(chain[i]);
  }
  return attempts;
}

function buildMovieVidkingFallbacks(tmdbId) {
  var attempts = [];
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

function buildTvVidkingFallbacks(tmdbId, season, episode) {
  var attempts = [];
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

function buildQualityUpgradeAttempts(tmdbId, type, season, episode) {
  var backup = {
    label: "TMDB-native backups",
    run: function () {
      if (type === "tv") {
        return api.resolveTvEpisode(
          tmdbId,
          season,
          episode,
          TMDB_BACKUP_QUERY,
          PRIMARY_RESOLVE_TIMEOUT_MS
        );
      }
      return api.resolveMovie(tmdbId, TMDB_BACKUP_QUERY, PRIMARY_RESOLVE_TIMEOUT_MS);
    },
  };
  return [backup];
}

function scheduleQualityUpgrade(session, currentPlay, title, onStatus, playOptions) {
  var target = config.getTargetResolution();
  if (target === "auto" || qualityUpgradeAttempted) return;
  var targetPx = config.targetResolutionPixels(target);
  if (!targetPx) return;

  var currentMax = config.maxSourceHeight(currentPlay);
  var playingH = lastKnownPlayingHeight || 0;
  if (playingH >= targetPx) return;
  if (!playingH && currentMax >= targetPx) return;
  if (!playOptions._upgradeAttempts || !playOptions._upgradeAttempts.length) return;

  qualityUpgradeAttempted = true;
  debug.debugLog("Searching for higher quality than " + (lastKnownPlayingHeight || currentMax || "?") + "p…");
  if (onStatus) onStatus("Searching for higher quality…");

  resolveWithTizenFallback(playOptions._upgradeAttempts, onStatus, session)
    .then(function (upgradeResult) {
      if (!isActivePlaySession(session)) return;
      if (!upgradeResult.play || !api.hasPlayableSources(upgradeResult.play)) return;

      var upgradeMax = config.maxSourceHeight(upgradeResult.play);
      var playingH = lastKnownPlayingHeight || currentMax;
      if (upgradeMax <= playingH) return;

      var video = document.getElementById("video");
      var pos = video && video.currentTime > 0 ? video.currentTime : 0;
      if (pos > 0) player.setResumePosition(pos);

      var want = config.preferredQualityForTarget(target) || target + "p";
      debug.debugLog("Upgrading to " + want + " via " + (upgradeResult.via || "alternate server"));
      if (onStatus) onStatus("Upgrading to " + want + "…");

      return playResolved(upgradeResult.play, title, onStatus, session, {
        startSeconds: pos,
        _fallbacks: playOptions._fallbacks || [],
      }).then(function () {
        if (onStatus) onStatus("Now playing " + want);
      });
    })
    .catch(function () {
      /* non-fatal background upgrade */
    });
}

function buildNextProviderFallbacks(currentProviderId, tmdbId, type, season, episode) {
  return buildStreamflixProviderFallbacks(tmdbId, type, season, episode, currentProviderId);
}

function buildVideasyFallbacks(tmdbId, type, season, episode) {
  var attempts = [];
  for (var i = 0; i < VIDEASY_SERVER_FALLBACKS.length; i++) {
    (function (fb) {
      attempts.push({
        label: fb.label,
        run: function () {
          if (type === "tv") {
            return api.resolveTvEpisode(tmdbId, season, episode, fb.query, fb.timeoutMs);
          }
          return api.resolveMovie(tmdbId, fb.query, fb.timeoutMs);
        },
      });
    })(VIDEASY_SERVER_FALLBACKS[i]);
  }
  return attempts;
}

function buildVideasyFallbacksExcluding(tmdbId, type, season, episode, excludeServer) {
  var all = buildVideasyFallbacks(tmdbId, type, season, episode);
  if (!excludeServer) return all;
  var lower = String(excludeServer).toLowerCase();
  return all.filter(function (attempt) {
    return String(attempt.label).toLowerCase() !== lower;
  });
}

function buildVidkingFallbacks(tmdbId, type, season, episode) {
  return type === "tv"
    ? buildTvVidkingFallbacks(tmdbId, season, episode)
    : buildMovieVidkingFallbacks(tmdbId);
}

function buildVidkingFallbacksExcluding(tmdbId, type, season, episode, excludeServer) {
  var all = buildVidkingFallbacks(tmdbId, type, season, episode);
  if (!excludeServer) return all;
  var lower = String(excludeServer).toLowerCase();
  return all.filter(function (attempt) {
    return String(attempt.label).toLowerCase() !== lower;
  });
}

function buildVixsrcFallback(tmdbId, type, season, episode) {
  return {
    label: "VixSrc",
    run: function () {
      if (type === "tv") {
        return api.resolveTvEpisode(
          tmdbId,
          season,
          episode,
          VIXSRC_QUERY,
          PRIMARY_RESOLVE_TIMEOUT_MS
        );
      }
      return api.resolveMovie(tmdbId, VIXSRC_QUERY, PRIMARY_RESOLVE_TIMEOUT_MS);
    },
  };
}

function buildPlaybackFallbacks(play, tmdbId, type, season, episode) {
  var current = currentPlayProvider(play);
  var backend = play && play.backend;
  if (backend === "videasy" || isVideasyProviderName(current) || (backend === "auto" && isVideasyProviderName(current))) {
    var videasyNext = buildVideasyFallbacksExcluding(
      tmdbId,
      type,
      season,
      episode,
      current
    );
    return videasyNext
      .concat([buildVixsrcFallback(tmdbId, type, season, episode)])
      .concat(buildStreamflixProviderFallbacks(tmdbId, type, season, episode, null))
      .concat(buildVidkingFallbacks(tmdbId, type, season, episode));
  }
  if (backend === "vidking" || isVidkingProviderName(current)) {
    var vidkingNext = buildVidkingFallbacksExcluding(
      tmdbId,
      type,
      season,
      episode,
      current
    );
    var streamflixAfter = buildStreamflixProviderFallbacks(
      tmdbId,
      type,
      season,
      episode,
      null
    );
    return vidkingNext.concat(streamflixAfter);
  }
  return buildNextProviderFallbacks(current, tmdbId, type, season, episode);
}

function buildReResolveQuery(overrides) {
  overrides = overrides || {};
  var parts = [];
  if (overrides.server) {
    parts.push("server=" + encodeURIComponent(overrides.server));
    parts.push(
      "backend=" +
        (isVideasyProviderName(overrides.server) ? "videasy" : "vidking")
    );
  } else if (overrides.providerId) {
    parts.push("providerId=" + encodeURIComponent(overrides.providerId));
    parts.push("backend=streamflix");
  } else if (overrides.onlySourceId) {
    parts.push("onlySourceId=" + encodeURIComponent(overrides.onlySourceId));
    parts.push(
      "backend=" + (overrides.onlySourceId === "videasy" ? "videasy" : "tmdb-native")
    );
  } else if (overrides.backend) {
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

function buildEmptyResolveAttempts(tmdbId, type, season, episode, preferred) {
  var backend = config.getPlayBackend();
  var emptyAttempts = [];
  if (backend === "videasy" || backend === "auto") {
    emptyAttempts = emptyAttempts.concat(
      buildVideasyFallbacks(tmdbId, type, season, episode)
    );
    emptyAttempts.push(buildVixsrcFallback(tmdbId, type, season, episode));
  }
  if (backend === "streamflix" || backend === "auto" || backend === "videasy" || backend === "vidking") {
    emptyAttempts = emptyAttempts.concat(
      buildStreamflixProviderFallbacks(tmdbId, type, season, episode, preferred)
    );
  }
  if (backend === "vidking" || backend === "auto") {
    emptyAttempts = emptyAttempts.concat(
      buildVidkingFallbacks(tmdbId, type, season, episode)
    );
  }
  emptyAttempts = emptyAttempts.concat(
    buildQualityUpgradeAttempts(tmdbId, type, season, episode)
  );
  if (!emptyAttempts.length) {
    emptyAttempts = buildStreamflixProviderFallbacks(
      tmdbId,
      type,
      season,
      episode,
      preferred
    );
  }
  return emptyAttempts;
}

function escalateEmptyOrFailedResolve(tmdbId, type, season, episode, onStatus, session, upgradeAttempts, preferred) {
  var emptyAttempts = buildEmptyResolveAttempts(
    tmdbId,
    type,
    season,
    episode,
    preferred
  );
  if (onStatus) onStatus("Trying alternate servers…");
  return resolveWithTizenFallback(emptyAttempts, onStatus, session).then(function (result) {
    result.fallbacks = [];
    result._upgradeAttempts = upgradeAttempts;
    return result;
  });
}

function resolvePlayback(tmdbId, type, season, episode, onStatus, session) {
  var query = buildPrimaryResolveQuery();
  var preferred = config.getPreferredProviderId();
  var upgradeAttempts = buildQualityUpgradeAttempts(tmdbId, type, season, episode);
  var key =
    type === "tv"
      ? playbackSession.prefetchKey("tv", tmdbId, season, episode)
      : playbackSession.prefetchKey("movie", tmdbId);
  var prefetched = playbackSession.getPrefetch(key);
  if (prefetched && api.hasPlayableSources(prefetched)) {
    debug.debugLog("Resolved via: prefetched");
    if (onStatus) onStatus("Starting playback…");
    return Promise.resolve({
      play: prefetched,
      via: "prefetched",
      fallbacks: buildPlaybackFallbacks(prefetched, tmdbId, type, season, episode),
      _upgradeAttempts: upgradeAttempts,
    });
  }

  return ensureApiReachable().then(function () {
    if (preferred) {
      if (onStatus) onStatus("Trying " + preferred + "…");
    } else if (onStatus) {
      onStatus("Finding stream…");
    }
    var resolvePromise =
      type === "tv"
        ? api.resolveTvEpisode(tmdbId, season, episode, query, PRIMARY_RESOLVE_TIMEOUT_MS)
        : api.resolveMovie(tmdbId, query, PRIMARY_RESOLVE_TIMEOUT_MS);

    return resolvePromise
      .then(function (play) {
        if (!isActivePlaySession(session)) return { play: null, fallbacks: [] };
        if (play && api.hasPlayableSources(play)) {
          var via =
            (play.sources[0] && play.sources[0].providerId) ||
            (play.sources[0] && play.sources[0].provider) ||
            play.backend ||
            "auto";
          debug.debugLog("Resolved via: " + via);
          if (onStatus) onStatus("Resolved via: " + via);
          if (play.warnings && play.warnings.length && onStatus) {
            onStatus("Trying fallback…");
          }
          return {
            play: play,
            via: via,
            fallbacks: buildPlaybackFallbacks(play, tmdbId, type, season, episode),
            _upgradeAttempts: upgradeAttempts,
          };
        }
        return escalateEmptyOrFailedResolve(
          tmdbId,
          type,
          season,
          episode,
          onStatus,
          session,
          upgradeAttempts,
          preferred
        );
      })
      .catch(function (err) {
        if (!isActivePlaySession(session)) return { play: null, fallbacks: [] };
        debug.debugLog(
          "Primary resolve failed — escalating: " +
            (err && err.message ? err.message : String(err))
        );
        return escalateEmptyOrFailedResolve(
          tmdbId,
          type,
          season,
          episode,
          onStatus,
          session,
          upgradeAttempts,
          preferred
        );
      });
  });
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
    .resolveMovie(tmdbId, buildPrimaryResolveQuery(), PRIMARY_RESOLVE_TIMEOUT_MS)
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
    .resolveTvEpisode(tmdbId, season, episode, buildPrimaryResolveQuery(), PRIMARY_RESOLVE_TIMEOUT_MS)
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
    .then(function (result) {
      if (!isActivePlaySession(session)) return;
      if (!result.play || !api.hasPlayableSources(result.play)) {
        return Promise.reject(new Error(formatResolveError(result.play)));
      }
      return playResolved(result.play, title, onStatus, session, {
        startSeconds: startSeconds,
        _fallbacks: result.fallbacks || [],
        _upgradeAttempts: result._upgradeAttempts || [],
      });
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
    .then(function (result) {
      if (!isActivePlaySession(session)) return;
      if (!result.play || !api.hasPlayableSources(result.play)) {
        return Promise.reject(new Error(formatResolveError(result.play)));
      }
      return playResolved(result.play, title, onStatus, session, {
        startSeconds: startSeconds,
        _fallbacks: result.fallbacks || [],
        _upgradeAttempts: result._upgradeAttempts || [],
      });
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
    if (overrides && overrides.providerId) {
      config.setPreferredProviderId(overrides.providerId);
    }
    return playResolved(play, stored.displayTitle, onStatus, playSession);
  });
}

function handleBackKey() {
  playerChrome.handleBack();
  return true;
}

function stop(options) {
  options = options || {};
  var video = document.getElementById("video");
  if (video) savePlaybackProgress(video, true);
  unbindProgressSaver();
  unbindAutoplayHandler();
  unbindQualityWatcher();
  pendingQualityUpgrade = null;

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
