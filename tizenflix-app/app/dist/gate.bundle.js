var TizenflixGate = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // app/js/core/config.js
  var require_config = __commonJS({
    "app/js/core/config.js"(exports, module) {
      var STORAGE_KEY = "tizenflix.apiBase";
      var QUALITY_MODE_KEY = "tizenflix.qualityMode";
      var DEFAULT_API = "http://192.168.86.11:8790";
      var PLAY_RESOLVE_TIMEOUT_MS = 9e4;
      var VALID_QUALITY_MODES = ["auto", "high", "medium", "low"];
      function getApiBase() {
        try {
          var stored = localStorage.getItem(STORAGE_KEY);
          if (stored && stored.indexOf("localhost") === -1 && stored.indexOf("127.0.0.1") === -1) {
            return stored;
          }
        } catch (err) {
        }
        return DEFAULT_API;
      }
      function setApiBase(url) {
        var trimmed = (url || "").replace(/\/$/, "");
        try {
          localStorage.setItem(STORAGE_KEY, trimmed);
        } catch (err) {
        }
        return trimmed;
      }
      function fetchWithTimeout(url, ms) {
        return new Promise(function(resolve, reject) {
          var done = false;
          var timer = setTimeout(function() {
            if (done) return;
            done = true;
            reject(new Error("Request timed out after " + ms + "ms"));
          }, ms);
          fetch(url).then(function(res) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(res);
          }).catch(function(err) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            reject(err);
          });
        });
      }
      function checkHealth(apiBase) {
        return fetchWithTimeout(apiBase + "/health", 8e3).then(function(res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });
      }
      function getQualityMode() {
        try {
          var stored = localStorage.getItem(QUALITY_MODE_KEY);
          if (stored && VALID_QUALITY_MODES.indexOf(stored) !== -1) return stored;
        } catch (err) {
        }
        return "auto";
      }
      function setQualityMode(mode) {
        var m = VALID_QUALITY_MODES.indexOf(mode) !== -1 ? mode : "auto";
        try {
          localStorage.setItem(QUALITY_MODE_KEY, m);
        } catch (err) {
        }
        return m;
      }
      function resolvePlay(apiBase, path, query) {
        var url = apiBase + path;
        if (query) {
          url += (url.indexOf("?") === -1 ? "?" : "&") + query;
        }
        return fetchWithTimeout(url, PLAY_RESOLVE_TIMEOUT_MS).then(function(res) {
          if (!res.ok) {
            return res.text().then(function(text) {
              throw new Error("Play API " + res.status + (text ? ": " + text.slice(0, 120) : ""));
            });
          }
          return res.json();
        });
      }
      function resolveMovie(apiBase, tmdbId, query) {
        return resolvePlay(apiBase, "/play/movie/" + encodeURIComponent(tmdbId), query);
      }
      function resolveTvEpisode(apiBase, tmdbId, season, episode, query) {
        var path = "/play/tv/" + encodeURIComponent(tmdbId) + "/" + encodeURIComponent(season) + "/" + encodeURIComponent(episode);
        return resolvePlay(apiBase, path, query);
      }
      function pickPlayableSource(play) {
        if (!play || !play.sources || !play.sources.length) return null;
        if (play.recommended) {
          for (var i = 0; i < play.sources.length; i++) {
            if (play.sources[i].id === play.recommended) return play.sources[i];
          }
        }
        return play.sources[0];
      }
      function listM3u8Sources(play) {
        if (!play || !play.sources) return [];
        var out = [];
        for (var i = 0; i < play.sources.length; i++) {
          if (play.sources[i].type === "m3u8") out.push(play.sources[i]);
        }
        return out;
      }
      function orderSourcesForPlay(play) {
        var sources = listM3u8Sources(play);
        if (!play || !play.recommended) return sources;
        var first = null;
        var rest = [];
        for (var i = 0; i < sources.length; i++) {
          if (sources[i].id === play.recommended) first = sources[i];
          else rest.push(sources[i]);
        }
        if (first) return [first].concat(rest);
        return sources;
      }
      function listSourcesToTry(play) {
        var ordered = orderSourcesForPlay(play);
        if (!play || !play.warnings || !play.warnings.length) return ordered;
        return ordered.filter(function(source) {
          var tag = source.provider + " " + source.label + ":";
          for (var i = 0; i < play.warnings.length; i++) {
            if (play.warnings[i].indexOf(tag) === 0) return false;
          }
          return true;
        });
      }
      function detectStreamType(url) {
        if (!url) return "unknown";
        var lower = url.toLowerCase();
        if (lower.indexOf(".m3u8") !== -1 || lower.indexOf("m3u8") !== -1) return "m3u8";
        if (lower.indexOf(".mp4") !== -1 || lower.indexOf(".webm") !== -1) return "mp4";
        return "unknown";
      }
      function logLine(container, message) {
        var el = document.createElement("div");
        var time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        el.textContent = "[" + time + "] " + message;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
      }
      module.exports = {
        STORAGE_KEY,
        QUALITY_MODE_KEY,
        PLAY_RESOLVE_TIMEOUT_MS,
        DEFAULT_API,
        VALID_QUALITY_MODES,
        getApiBase,
        setApiBase,
        getQualityMode,
        setQualityMode,
        checkHealth,
        resolveMovie,
        resolveTvEpisode,
        pickPlayableSource,
        listM3u8Sources,
        orderSourcesForPlay,
        listSourcesToTry,
        detectStreamType,
        logLine
      };
    }
  });

  // app/js/core/debug.js
  var require_debug = __commonJS({
    "app/js/core/debug.js"(exports, module) {
      var MAX_LINES = 8;
      var lines = [];
      var READY_LABELS = {
        0: "nothing",
        1: "metadata",
        2: "current",
        3: "future",
        4: "enough"
      };
      var NETWORK_LABELS = {
        0: "empty",
        1: "idle",
        2: "loading",
        3: "no_source"
      };
      function render() {
        var el = document.getElementById("debugOverlay");
        if (!el) return;
        el.textContent = lines.join("\n");
      }
      function debugLog(msg) {
        var time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        lines.push("[" + time + "] " + msg);
        if (lines.length > MAX_LINES) lines = lines.slice(lines.length - MAX_LINES);
        render();
      }
      function debugClear() {
        lines = [];
        render();
      }
      function describeVideoError(video) {
        if (!video || !video.error) return "no video.error";
        var e = video.error;
        var codes = {
          1: "MEDIA_ERR_ABORTED",
          2: "MEDIA_ERR_NETWORK",
          3: "MEDIA_ERR_DECODE",
          4: "MEDIA_ERR_SRC_NOT_SUPPORTED"
        };
        return (codes[e.code] || "code " + e.code) + (e.message ? ": " + e.message : "");
      }
      function formatVideoState(video) {
        if (!video) return "no video";
        var rs = video.readyState;
        var ns = video.networkState;
        return "rs=" + rs + "(" + (READY_LABELS[rs] || "?") + ") ns=" + ns + "(" + (NETWORK_LABELS[ns] || "?") + ") paused=" + video.paused;
      }
      function attachVideoDebug(video, onLog) {
        if (!video) return;
        function logState(eventName) {
          var msg = eventName + " " + formatVideoState(video);
          debugLog(msg);
          if (onLog) onLog(msg);
        }
        video.addEventListener("loadstart", function() {
          logState("loadstart");
        });
        video.addEventListener("loadedmetadata", function() {
          logState("loadedmetadata");
        });
        video.addEventListener("canplay", function() {
          logState("canplay");
        });
        video.addEventListener("loadeddata", function() {
          logState("loadeddata");
        });
        video.addEventListener("playing", function() {
          debugLog("playing t=" + Math.floor(video.currentTime) + "s " + formatVideoState(video));
        });
        video.addEventListener("waiting", function() {
          debugLog("buffering... " + formatVideoState(video));
        });
        video.addEventListener("error", function() {
          var msg = "video error \u2014 " + describeVideoError(video) + " " + formatVideoState(video);
          debugLog(msg);
          if (onLog) onLog(msg);
        });
      }
      module.exports = {
        debugLog,
        debugClear,
        describeVideoError,
        formatVideoState,
        attachVideoDebug
      };
    }
  });

  // app/js/player/player.js
  var require_player = __commonJS({
    "app/js/player/player.js"(exports, module) {
      var config2 = require_config();
      var debug2 = require_debug();
      var hlsInstance = null;
      var playbackEntered = false;
      var activeCleanups = [];
      var playGeneration = 0;
      var currentProvider = null;
      var playbackReported = false;
      var nonFatalRecoveries = 0;
      var READY_TIMEOUT_MS = 12e3;
      var HLS_PRIME_BUFFER_SEC = 20;
      var HLS_PRIME_TIMEOUT_MS = 25e3;
      var MAX_NON_FATAL_RECOVERIES = 8;
      function beginPlaySession() {
        playGeneration += 1;
        return playGeneration;
      }
      function isActiveSession(session) {
        return session === playGeneration;
      }
      function clearActiveCleanups() {
        for (var i = 0; i < activeCleanups.length; i++) {
          try {
            activeCleanups[i]();
          } catch (e) {
          }
        }
        activeCleanups = [];
      }
      function trackCleanup(fn) {
        activeCleanups.push(fn);
        return fn;
      }
      function isTizenTv() {
        var ua = navigator.userAgent || "";
        return ua.indexOf("SMART-TV") !== -1 || ua.indexOf("Tizen") !== -1;
      }
      function prefersNativeHls() {
        return isTizenTv();
      }
      function canNativeHls(video) {
        if (!video || !video.canPlayType) return false;
        var t = video.canPlayType("application/vnd.apple.mpegurl");
        return t === "probably" || t === "maybe";
      }
      function setCrossOrigin(video, needed) {
        if (!video) return;
        if (needed) video.setAttribute("crossorigin", "anonymous");
        else video.removeAttribute("crossorigin");
      }
      function destroyPlayer(video) {
        beginPlaySession();
        clearActiveCleanups();
        hlsWarnLast = {};
        nonFatalRecoveries = 0;
        playbackReported = false;
        currentProvider = null;
        playbackEntered = false;
        if (hlsInstance) {
          try {
            hlsInstance.stopLoad();
          } catch (e) {
          }
          try {
            hlsInstance.detachMedia();
          } catch (e) {
          }
          hlsInstance.destroy();
          hlsInstance = null;
        }
        if (video) {
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
      }
      function showVideoWrap(wrap) {
        if (wrap) wrap.classList.add("is-active");
      }
      function enterPlaybackMode(title) {
        if (playbackEntered) return;
        playbackEntered = true;
        document.body.classList.add("is-playing");
        var status = document.getElementById("playbackStatus");
        var nowPlaying = document.getElementById("nowPlaying");
        if (status && title) status.textContent = "Playing: " + title;
        if (nowPlaying) {
          nowPlaying.textContent = "Now playing: " + (title || "movie");
          nowPlaying.classList.add("is-live");
        }
      }
      function exitPlaybackMode() {
        clearActiveCleanups();
        playbackEntered = false;
        document.body.classList.remove("is-playing");
        var nowPlaying = document.getElementById("nowPlaying");
        if (nowPlaying) {
          nowPlaying.textContent = "Video appears here when playback starts.";
          nowPlaying.classList.remove("is-live");
        }
        var wrap = document.getElementById("videoWrap");
        if (wrap) wrap.classList.remove("is-active");
      }
      function safePlay(video, onError) {
        try {
          var result = video.play();
          if (result && typeof result.catch === "function") {
            result.catch(function(e) {
              var msg2 = "Autoplay blocked: " + e.message;
              debug2.debugLog(msg2);
              if (onError) onError(msg2);
            });
          }
        } catch (e) {
          var msg = "play() threw: " + e.message;
          debug2.debugLog(msg);
          if (onError) onError(msg);
        }
      }
      function prepareVideoElement(video, videoWrap) {
        video.setAttribute("controls", "controls");
        showVideoWrap(videoWrap);
      }
      function setupPlayingListener(video, title) {
        var onPlaying = function() {
          video.removeEventListener("playing", onPlaying);
          enterPlaybackMode(title);
          debug2.debugLog("Entered fullscreen on playing");
        };
        video.addEventListener("playing", onPlaying);
        trackCleanup(function() {
          video.removeEventListener("playing", onPlaying);
        });
      }
      function whenCanPlay(video, callback, timeoutMs, onTimeout, session) {
        if (video.readyState >= 2) {
          callback();
          return function() {
          };
        }
        var called = false;
        function onReady() {
          if (called || !isActiveSession(session)) return;
          called = true;
          video.removeEventListener("loadedmetadata", onReady);
          video.removeEventListener("canplay", onReady);
          clearTimeout(timer);
          callback();
        }
        video.addEventListener("loadedmetadata", onReady);
        video.addEventListener("canplay", onReady);
        var timer = setTimeout(function() {
          if (called || !isActiveSession(session)) return;
          called = true;
          video.removeEventListener("loadedmetadata", onReady);
          video.removeEventListener("canplay", onReady);
          if (onTimeout) onTimeout();
        }, timeoutMs || READY_TIMEOUT_MS);
        return trackCleanup(function() {
          if (!called) {
            called = true;
            clearTimeout(timer);
            video.removeEventListener("loadedmetadata", onReady);
            video.removeEventListener("canplay", onReady);
          }
        });
      }
      function hintResumeIfPaused(video, onLog) {
        setTimeout(function() {
          if (video.paused && video.readyState >= 2) {
            var msg = "Loaded \u2014 press Play on remote or tap Resume";
            debug2.debugLog(msg);
            if (onLog) onLog(msg);
          }
        }, 500);
      }
      function attemptPlay(video, onLog) {
        logVideoState(video, "before safePlay()");
        safePlay(video, function(msg) {
          if (onLog) onLog(msg);
        });
        logVideoState(video, "after safePlay()");
        hintResumeIfPaused(video, onLog);
      }
      function startPlaybackWhenReady(video, videoWrap, title, onLog, options) {
        options = options || {};
        var session = options.session;
        prepareVideoElement(video, videoWrap);
        setupPlayingListener(video, title);
        whenCanPlay(
          video,
          function() {
            if (!isActiveSession(session)) return;
            logVideoState(video, "canplay ready");
            attemptPlay(video, onLog);
          },
          options.timeoutMs || READY_TIMEOUT_MS,
          function() {
            if (!isActiveSession(session)) return;
            logVideoState(video, "stall timeout");
            if (options.onStall) {
              options.onStall();
            } else {
              var msg = "Playback stall \u2014 readyState never reached 2";
              debug2.debugLog(msg);
              if (onLog) onLog(msg);
            }
          },
          session
        );
      }
      function resetVideoSource(video) {
        clearActiveCleanups();
        video.removeAttribute("src");
        video.load();
      }
      function isProxiedHls(url) {
        return url && url.indexOf("/proxy/stream") !== -1;
      }
      function prefersHlsJsFirst(url) {
        return isProxiedHls(url);
      }
      function createHlsInstance() {
        return new Hls({
          enableWorker: false,
          maxBufferLength: 60,
          maxMaxBufferLength: 180,
          maxBufferSize: 120 * 1e3 * 1e3,
          maxBufferHole: 2,
          highBufferWatchdogPeriod: 3,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 12,
          maxFragLookUpTolerance: 0.5,
          maxAudioFramesDrift: 3,
          stretchShortVideoTrack: true,
          fragLoadingTimeOut: 9e4,
          manifestLoadingTimeOut: 45e3,
          levelLoadingTimeOut: 45e3,
          fragLoadingMaxRetry: 10,
          fragLoadingRetryDelay: 1500,
          manifestLoadingMaxRetry: 6,
          levelLoadingMaxRetry: 6,
          startLevel: -1,
          capLevelToPlayerSize: false,
          testBandwidth: false,
          abrEwmaDefaultEstimate: 8e6,
          startFragPrefetch: true,
          backBufferLength: 45
        });
      }
      function getQualityOptions(hls) {
        if (!hls || !hls.levels || !hls.levels.length) return [];
        var out = [];
        for (var i = 0; i < hls.levels.length; i++) {
          var level = hls.levels[i];
          var label = level.height ? level.width + "x" + level.height : "Level " + (i + 1);
          out.push({ level: i, label, bitrate: level.bitrate || 0 });
        }
        return out;
      }
      function applyQualityMode(hls, mode) {
        if (!hls) return;
        var m = mode || config2.getQualityMode();
        if (m === "auto") {
          hls.currentLevel = -1;
          return;
        }
        var levels = hls.levels ? hls.levels.length : 0;
        if (!levels) return;
        if (m === "high") {
          hls.currentLevel = 0;
          return;
        }
        if (m === "medium") {
          hls.currentLevel = levels > 1 ? 1 : 0;
          return;
        }
        if (m === "low") {
          hls.currentLevel = levels - 1;
        }
      }
      function reportPlaybackHealth(success) {
        if (playbackReported || !currentProvider) return;
        playbackReported = true;
        var base = config2.getApiBase();
        fetch(base + "/play/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: currentProvider, success })
        }).catch(function() {
        });
      }
      function setupPlaybackHealthReport(video, session) {
        var reported = false;
        var timer = setTimeout(function() {
          if (!isActiveSession(session) || reported) return;
          if (!video.paused && video.currentTime > 5) {
            reported = true;
            reportPlaybackHealth(true);
          }
        }, 6e3);
        trackCleanup(function() {
          clearTimeout(timer);
        });
      }
      function bufferedAheadSec(video) {
        try {
          if (!video || !video.buffered || !video.buffered.length) return 0;
          return video.buffered.end(video.buffered.length - 1) - video.currentTime;
        } catch (e) {
          return 0;
        }
      }
      function startHlsPlaybackWhenBuffered(video, videoWrap, title, onLog, session, hls) {
        prepareVideoElement(video, videoWrap);
        setupPlayingListener(video, title);
        var started = false;
        function maybeStart(label) {
          if (started || !isActiveSession(session)) return;
          var ahead = bufferedAheadSec(video);
          if (ahead >= HLS_PRIME_BUFFER_SEC || video.readyState >= 4) {
            started = true;
            debug2.debugLog("HLS buffer primed " + Math.floor(ahead) + "s (" + (label || "ready") + ")");
            if (onLog) onLog("Buffer primed " + Math.floor(ahead) + "s \u2014 starting smooth playback");
            attemptPlay(video, onLog);
          }
        }
        function onProgress() {
          maybeStart("progress");
        }
        video.addEventListener("progress", onProgress);
        trackCleanup(function() {
          video.removeEventListener("progress", onProgress);
        });
        if (hls && Hls.Events && Hls.Events.FRAG_BUFFERED) {
          hls.on(Hls.Events.FRAG_BUFFERED, function() {
            maybeStart("frag");
          });
        }
        setTimeout(function() {
          if (started || !isActiveSession(session)) return;
          var ahead = bufferedAheadSec(video);
          debug2.debugLog("HLS prime timeout \u2014 starting with " + Math.floor(ahead) + "s buffered");
          if (onLog) onLog("Starting with " + Math.floor(ahead) + "s buffered");
          started = true;
          attemptPlay(video, onLog);
        }, HLS_PRIME_TIMEOUT_MS);
      }
      function setupHlsStallRecovery(video, hls, session, onLog) {
        var stallTimer = null;
        function clearStall() {
          if (stallTimer) {
            clearTimeout(stallTimer);
            stallTimer = null;
          }
        }
        function onWaiting() {
          clearStall();
          stallTimer = setTimeout(function() {
            if (!isActiveSession(session) || !hls) return;
            var ahead = bufferedAheadSec(video);
            if (ahead > 3) return;
            var msg = "Long stall (" + Math.floor(ahead) + "s ahead) \u2014 recovering";
            debug2.debugLog(msg);
            if (onLog) onLog(msg);
            try {
              if (hls.media) hls.recoverMediaError();
            } catch (e) {
            }
            safePlay(video);
          }, 2e4);
        }
        video.addEventListener("waiting", onWaiting);
        video.addEventListener("playing", clearStall);
        trackCleanup(function() {
          clearStall();
          video.removeEventListener("waiting", onWaiting);
          video.removeEventListener("playing", clearStall);
        });
      }
      function recoverNonFatalHlsError(hls, video, data, onLog) {
        if (!hls || nonFatalRecoveries >= MAX_NON_FATAL_RECOVERIES) return false;
        nonFatalRecoveries += 1;
        var details = data.details || "";
        var msg = "Recovering from " + details + " (" + nonFatalRecoveries + ")";
        debug2.debugLog(msg);
        if (onLog) onLog(msg);
        if (details === "bufferStalledError") {
          try {
            if (video.currentTime > 0) video.currentTime += 0.05;
            hls.startLoad(-1);
            safePlay(video);
          } catch (e) {
          }
          return true;
        }
        if (details === "fragLoadTimeOut" || details === "fragLoadError") {
          try {
            hls.startLoad(-1);
          } catch (e) {
          }
          return true;
        }
        return false;
      }
      var hlsWarnLast = {};
      function logHlsIssue(onLog, msg, details, fatal) {
        if (!fatal && details) {
          var now = Date.now();
          var last = hlsWarnLast[details] || 0;
          if (now - last < 2e4) return;
          hlsWarnLast[details] = now;
        }
        debug2.debugLog(msg);
        if (onLog) onLog(msg);
      }
      function playHlsJs(video, url, onLog, videoWrap, title, session, onFatal) {
        debug2.debugLog("Player path: HLS.js");
        if (onLog) onLog("Player path: HLS.js \u2014 priming buffer...");
        hlsWarnLast = {};
        setCrossOrigin(video, true);
        hlsInstance = createHlsInstance();
        var fatalRetries = 0;
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
        setupHlsStallRecovery(video, hlsInstance, session, onLog);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
          if (!isActiveSession(session)) return;
          debug2.debugLog("HLS.js manifest parsed");
          if (onLog) onLog("HLS.js manifest parsed \u2014 buffering ahead");
          applyQualityMode(hlsInstance, config2.getQualityMode());
          setupPlaybackHealthReport(video, session);
          startHlsPlaybackWhenBuffered(video, videoWrap, title, onLog, session, hlsInstance);
        });
        hlsInstance.on(Hls.Events.LEVEL_LOADED, function(event, data) {
          if (!isActiveSession(session) || !data || !data.details) return;
          var h = data.details.height;
          var w = data.details.width;
          if (w && h) {
            var q = "Quality: " + w + "x" + h;
            debug2.debugLog(q);
            if (onLog) onLog(q);
          }
        });
        hlsInstance.on(Hls.Events.ERROR, function(event, data) {
          if (!isActiveSession(session)) return;
          var msg = "HLS.js " + (data.fatal ? "FATAL" : "warn") + " " + data.type + " / " + data.details;
          if (data.response && data.response.code) {
            msg += " HTTP " + data.response.code;
          }
          logHlsIssue(onLog, msg, data.details, data.fatal);
          if (!data.fatal) {
            recoverNonFatalHlsError(hlsInstance, video, data, onLog);
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && fatalRetries < 3) {
            fatalRetries += 1;
            debug2.debugLog("HLS network error \u2014 retry " + fatalRetries);
            if (onLog) onLog("HLS network error \u2014 retry " + fatalRetries);
            try {
              hlsInstance.startLoad(-1);
            } catch (e) {
            }
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && fatalRetries < 3) {
            fatalRetries += 1;
            debug2.debugLog("HLS media error \u2014 recover " + fatalRetries);
            if (onLog) onLog("HLS media error \u2014 recover " + fatalRetries);
            try {
              hlsInstance.recoverMediaError();
            } catch (e) {
            }
            return;
          }
          if (hlsInstance) {
            try {
              hlsInstance.detachMedia();
            } catch (e) {
            }
            hlsInstance.destroy();
            hlsInstance = null;
            reportPlaybackHealth(false);
            if (onFatal) onFatal(msg);
          }
        });
      }
      function playNativeHls(video, url, onLog, videoWrap, title, session, onStallFallback, onFatal) {
        debug2.debugLog("Player path: native HLS");
        if (onLog) onLog("Player path: native HLS (wait up to 12s, then HLS.js fallback)");
        setCrossOrigin(video, true);
        video.src = url;
        function fallback(reason) {
          if (!isActiveSession(session) || !onStallFallback) return;
          debug2.debugLog(reason);
          if (onLog) onLog(reason);
          resetVideoSource(video);
          onStallFallback();
        }
        function onVideoError() {
          video.removeEventListener("error", onVideoError);
          if (onStallFallback) {
            fallback("Native HLS video error \u2014 falling back to HLS.js");
            return;
          }
          if (onFatal) {
            onFatal("Native HLS video error");
          }
        }
        video.addEventListener("error", onVideoError);
        trackCleanup(function() {
          video.removeEventListener("error", onVideoError);
        });
        startPlaybackWhenReady(video, videoWrap, title, onLog, {
          session,
          onStall: function() {
            if (video.networkState === 3) {
              debug2.debugLog("Native HLS: networkState=no_source");
              if (onLog) onLog("Native HLS: no compatible source");
            }
            if (onStallFallback) {
              fallback("Native HLS stall \u2014 falling back to HLS.js");
              return;
            }
            if (onFatal) {
              onFatal("Native HLS stall");
            }
          }
        });
      }
      function playUrlAttempt(video, url, onLog, videoWrap, title, streamType, onFatal) {
        var session = playGeneration;
        var type = streamType || config2.detectStreamType(url);
        if (type === "m3u8") {
          if (prefersHlsJsFirst(url) && window.Hls && Hls.isSupported()) {
            playHlsJs(video, url, onLog, videoWrap, title, session, onFatal);
            return;
          }
          if (prefersNativeHls() && canNativeHls(video)) {
            playNativeHls(video, url, onLog, videoWrap, title, session, function() {
              if (!isActiveSession(session)) return;
              if (window.Hls && Hls.isSupported()) {
                playHlsJs(video, url, onLog, videoWrap, title, session, onFatal);
              } else {
                debug2.debugLog("HLS.js not available for fallback");
                if (onLog) onLog("HLS.js not available for fallback");
                if (onFatal) onFatal("HLS.js not available");
              }
            }, onFatal);
            return;
          }
          if (window.Hls && Hls.isSupported()) {
            playHlsJs(video, url, onLog, videoWrap, title, session, onFatal);
            return;
          }
          if (canNativeHls(video)) {
            playNativeHls(video, url, onLog, videoWrap, title, session, null, onFatal);
            return;
          }
          debug2.debugLog("No HLS player available");
          if (onLog) onLog("No HLS player available");
          if (onFatal) onFatal("No HLS player available");
          return;
        }
        playDirectVideo(video, url, onLog, videoWrap, title, session, false);
      }
      function playUrl(video, url, onLog, videoWrap, title, streamType, onFatal) {
        destroyPlayer(video);
        playUrlAttempt(video, url, onLog, videoWrap, title, streamType, onFatal);
      }
      function playDirectVideo(video, url, onLog, videoWrap, title, session, needsCors) {
        debug2.debugLog("Player path: direct " + config2.detectStreamType(url));
        if (onLog) onLog("Player path: direct " + config2.detectStreamType(url));
        setCrossOrigin(video, !!needsCors);
        video.src = url;
        startPlaybackWhenReady(video, videoWrap, title, onLog, { session });
      }
      function playDirect(video, url, onLog, videoWrap, title, needsCors) {
        destroyPlayer(video);
        var session = playGeneration;
        playDirectVideo(video, url, onLog, videoWrap, title, session, needsCors);
      }
      function playSources(video, sources, onLog, videoWrap, title) {
        if (!sources || !sources.length) {
          debug2.debugLog("No sources to play");
          if (onLog) onLog("No sources to play");
          return;
        }
        destroyPlayer(video);
        var index = 0;
        currentProvider = sources[0] && sources[0].provider ? sources[0].provider : null;
        playbackReported = false;
        nonFatalRecoveries = 0;
        function tryNext(reason) {
          if (reason) {
            debug2.debugLog(reason);
            if (onLog) onLog(reason);
          }
          if (index >= sources.length) {
            var done = "All sources failed \u2014 CDN may be blocking playback";
            debug2.debugLog(done);
            if (onLog) onLog(done);
            return;
          }
          if (index > 0) {
            clearActiveCleanups();
            if (hlsInstance) {
              try {
                hlsInstance.stopLoad();
              } catch (e) {
              }
              try {
                hlsInstance.detachMedia();
              } catch (e) {
              }
              hlsInstance.destroy();
              hlsInstance = null;
            }
            video.pause();
            video.removeAttribute("src");
            video.load();
          }
          var source = sources[index];
          index += 1;
          currentProvider = source.provider || null;
          playbackReported = false;
          nonFatalRecoveries = 0;
          var label = "Trying " + source.provider + " " + source.label + " (" + index + "/" + sources.length + ")";
          debug2.debugLog(label);
          if (onLog) onLog(label);
          playUrlAttempt(video, source.url, onLog, videoWrap, title, source.type, function(fatalMsg) {
            tryNext(fatalMsg);
          });
        }
        tryNext();
      }
      function logVideoState(video, label) {
        if (!video) return;
        debug2.debugLog((label || "video") + " " + debug2.formatVideoState(video));
      }
      function togglePlayPause(video, onLog) {
        if (!video) return;
        if (video.paused) {
          safePlay(video, function(msg) {
            if (onLog) onLog(msg);
          });
          if (onLog) onLog("Resume");
          debug2.debugLog("Resume");
        } else {
          video.pause();
          if (onLog) onLog("Paused");
          debug2.debugLog("Paused");
        }
      }
      function isMediaPlayPauseKey(e) {
        if (!e) return false;
        if (e.key === "MediaPlayPause") return true;
        if (e.keyCode === 415 || e.keyCode === 10252 || e.keyCode === 179) return true;
        return false;
      }
      module.exports = {
        destroyPlayer,
        playUrl,
        playSources,
        playDirect,
        showVideoWrap,
        enterPlaybackMode,
        exitPlaybackMode,
        isTizenTv,
        logVideoState,
        safePlay,
        togglePlayPause,
        isMediaPlayPauseKey,
        getQualityOptions,
        applyQualityMode,
        getHlsInstance: function() {
          return hlsInstance;
        }
      };
    }
  });

  // app/js/core/focus.js
  var require_focus = __commonJS({
    "app/js/core/focus.js"(exports, module) {
      var FOCUS_SELECTOR = "button, input[type='text'], a, [tabindex='0']";
      function getFocusables(root) {
        var nodes = root.querySelectorAll(FOCUS_SELECTOR);
        var list = [];
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el.disabled) continue;
          if (el.offsetParent === null && el !== document.activeElement) continue;
          list.push(el);
        }
        return list;
      }
      function clearTvFocus(list) {
        for (var i = 0; i < list.length; i++) {
          list[i].classList.remove("tv-focus");
        }
      }
      function labelFor(el) {
        if (!el) return "";
        if (el.id === "apiBase") return "API URL";
        if (el.id === "saveApiBtn") return "Save & test";
        if (el.id === "testMp4Btn") return "Test LAN MP4";
        if (el.id === "testHlsBtn") return "Test API HLS";
        if (el.id === "playBtn") return "Play movie";
        if (el.id === "stopBtn" || el.id === "stopBtnBar") return "Stop";
        return el.textContent || el.tagName;
      }
      function setupFocus(root, onFocusChange) {
        var index = 0;
        function setFocus(i) {
          var list = getFocusables(root);
          if (!list.length) return;
          clearTvFocus(list);
          index = (i % list.length + list.length) % list.length;
          var el = list[index];
          el.classList.add("tv-focus");
          if (onFocusChange) onFocusChange(labelFor(el));
        }
        setFocus(0);
        document.addEventListener("keydown", function(e) {
          var list = getFocusables(root);
          if (!list.length) return;
          var key = e.key || "";
          var code = e.keyCode;
          if (key === "ArrowLeft" || code === 37) {
            setFocus(index - 1);
            e.preventDefault();
          } else if (key === "ArrowRight" || code === 39) {
            setFocus(index + 1);
            e.preventDefault();
          } else if (key === "ArrowUp" || code === 38) {
            setFocus(index - 1);
            e.preventDefault();
          } else if (key === "ArrowDown" || code === 40) {
            setFocus(index + 1);
            e.preventDefault();
          } else if (code === 13 || key === "Enter") {
            var focused = list[index];
            if (focused && focused.click) focused.click();
            e.preventDefault();
          } else if (code === 10009 || key === "Back" || key === "XF86Back") {
            e.preventDefault();
          }
        });
        return { setFocus };
      }
      module.exports = { setupFocus, getFocusables };
    }
  });

  // app/js/gate/main.js
  var config = require_config();
  var player = require_player();
  var focus = require_focus();
  var debug = require_debug();
  var TEST_MOVIE_TMDB_ID = "27205";
  var OFF_CAMPUS_TMDB_ID = "273240";
  var OFF_CAMPUS_SEASON = 1;
  function markCheck(el, pass) {
    if (!el) return;
    el.classList.remove("pass", "fail");
    el.classList.add(pass ? "pass" : "fail");
    var text = el.textContent.replace(/^[✓✗]\s*/, "");
    el.textContent = (pass ? "\u2713 " : "\u2717 ") + text;
  }
  function setBanner(banner, kind, text) {
    banner.className = "status " + kind;
    banner.textContent = text;
  }
  function init() {
    var banner = document.getElementById("banner");
    var apiInput = document.getElementById("apiBase");
    var healthLog = document.getElementById("healthLog");
    var playerLog = document.getElementById("playerLog");
    var video = document.getElementById("video");
    var videoWrap = document.getElementById("videoWrap");
    var playBtn = document.getElementById("playBtn");
    var stopBtn = document.getElementById("stopBtn");
    var playPauseBtn = document.getElementById("playPauseBtn");
    var testMp4Btn = document.getElementById("testMp4Btn");
    var testHlsBtn = document.getElementById("testHlsBtn");
    var playTvS1E1Btn = document.getElementById("playTvS1E1Btn");
    var playTvS1E2Btn = document.getElementById("playTvS1E2Btn");
    var playTvS1E3Btn = document.getElementById("playTvS1E3Btn");
    var focusHint = document.getElementById("focusHint");
    var jsStatus = document.getElementById("jsStatus");
    var testButtons = [
      playBtn,
      testMp4Btn,
      testHlsBtn,
      playTvS1E1Btn,
      playTvS1E2Btn,
      playTvS1E3Btn
    ];
    if (jsStatus) {
      jsStatus.textContent = "JavaScript loaded";
      jsStatus.style.color = "#46d369";
    }
    debug.debugClear();
    debug.debugLog("Tizen TV: " + (player.isTizenTv() ? "yes" : "no"));
    debug.attachVideoDebug(video, playerDbg);
    var checks = {
      health: document.getElementById("check-health"),
      resolve: document.getElementById("check-resolve"),
      video: document.getElementById("check-video"),
      hls: document.getElementById("check-hls"),
      tv: document.getElementById("check-tv"),
      back: document.getElementById("check-back")
    };
    var apiHealthy = false;
    function healthDbg(msg) {
      config.logLine(healthLog, msg);
    }
    function playerDbg(msg) {
      config.logLine(playerLog, msg);
      debug.debugLog(msg);
    }
    function updateFocusHint(label) {
      if (focusHint) focusHint.textContent = "Focused: " + label;
    }
    function setTestButtonsDisabled(disabled) {
      for (var i = 0; i < testButtons.length; i++) {
        if (testButtons[i]) testButtons[i].disabled = disabled;
      }
    }
    function wireVideoCallbacks(opts) {
      opts = opts || {};
      video.onplaying = function() {
        markCheck(checks.video, true);
        if (opts.onTvPlaying) opts.onTvPlaying();
      };
      video.onwaiting = function() {
        playerDbg("Buffering...");
      };
      video.onerror = function() {
        markCheck(checks.video, false);
        playerDbg("Video element error \u2014 " + debug.describeVideoError(video));
      };
      var progressed = false;
      video.ontimeupdate = function() {
        if (!progressed && video.currentTime > 1) {
          progressed = true;
          markCheck(checks.hls, true);
        }
      };
    }
    apiInput.value = config.getApiBase();
    function testApi() {
      var base = config.setApiBase(apiInput.value.trim() || config.getApiBase());
      healthLog.innerHTML = "";
      healthDbg("Testing " + base + "/health ...");
      setBanner(banner, "info", "Checking API...");
      return config.checkHealth(base).then(
        function(data) {
          healthDbg("OK \u2014 " + JSON.stringify(data));
          markCheck(checks.health, true);
          apiHealthy = true;
          setBanner(banner, "ok", "API reachable.");
          return base;
        },
        function(err) {
          healthDbg("FAILED \u2014 " + err.message);
          markCheck(checks.health, false);
          apiHealthy = false;
          setBanner(
            banner,
            "err",
            "Cannot reach API. Is tizenflix-api running with PUBLIC_BASE set to your LAN IP?"
          );
          throw err;
        }
      );
    }
    function ensureApiReady() {
      if (apiHealthy) {
        return Promise.resolve(config.setApiBase(apiInput.value.trim() || config.getApiBase()));
      }
      return testApi();
    }
    function playResolvedContent(options) {
      playerLog.innerHTML = "";
      debug.debugClear();
      debug.debugLog("Starting: " + options.label);
      setTestButtonsDisabled(true);
      setBanner(banner, "info", "Resolving stream (this can take up to a minute)...");
      return ensureApiReady().then(function(base) {
        var fullUrl = base + options.playPath;
        if (options.playQuery) {
          fullUrl += (fullUrl.indexOf("?") === -1 ? "?" : "&") + options.playQuery;
        }
        playerDbg("GET " + fullUrl);
        return options.resolve(base).then(function(play) {
          return { base, play };
        });
      }).then(function(result) {
        var play = result.play;
        var sources = config.listSourcesToTry(play);
        if (!sources.length) {
          markCheck(checks.resolve, false);
          var warn = play.warnings && play.warnings.length ? play.warnings.join("; ") : "No playable HLS sources";
          throw new Error(warn);
        }
        markCheck(checks.resolve, true);
        if (play.warnings && play.warnings.length) {
          for (var w = 0; w < play.warnings.length; w++) {
            playerDbg("API: " + play.warnings[w]);
          }
        }
        playerDbg("Sources to try: " + sources.length);
        wireVideoCallbacks(options.wireOpts || {});
        var title = play.title || options.defaultTitle || "Playback";
        player.playSources(video, sources, playerDbg, videoWrap, title);
        if (play.recommended) {
          setBanner(banner, "ok", "Playing \u2014 " + title);
        } else {
          setBanner(banner, "warn", "No verified sources \u2014 trying all streams anyway");
        }
      }).catch(function(err) {
        setBanner(banner, "err", err.message);
        playerDbg("ERROR \u2014 " + err.message);
      }).then(function() {
        setTestButtonsDisabled(false);
      });
    }
    function resolveMoviePlay(label) {
      var playPath = "/play/movie/" + TEST_MOVIE_TMDB_ID;
      return playResolvedContent({
        label,
        playPath,
        defaultTitle: "Inception",
        resolve: function(base) {
          return config.resolveMovie(base, TEST_MOVIE_TMDB_ID);
        }
      });
    }
    function resolveTvPlay(season, episode, label) {
      var playPath = "/play/tv/" + OFF_CAMPUS_TMDB_ID + "/" + season + "/" + episode;
      return playResolvedContent({
        label,
        playPath,
        defaultTitle: "Off Campus S" + season + "E" + episode,
        wireOpts: {
          onTvPlaying: function() {
            markCheck(checks.tv, true);
          }
        },
        resolve: function(base) {
          return config.resolveTvEpisode(
            base,
            OFF_CAMPUS_TMDB_ID,
            season,
            episode
          );
        }
      });
    }
    document.getElementById("saveApiBtn").addEventListener("click", function() {
      testApi().catch(function() {
      });
    });
    playBtn.addEventListener("click", function() {
      resolveMoviePlay("Play movie");
    });
    if (playTvS1E1Btn) {
      playTvS1E1Btn.addEventListener("click", function() {
        resolveTvPlay(OFF_CAMPUS_SEASON, 1, "Off Campus S1E1");
      });
    }
    if (playTvS1E2Btn) {
      playTvS1E2Btn.addEventListener("click", function() {
        resolveTvPlay(OFF_CAMPUS_SEASON, 2, "Off Campus S1E2");
      });
    }
    if (playTvS1E3Btn) {
      playTvS1E3Btn.addEventListener("click", function() {
        resolveTvPlay(OFF_CAMPUS_SEASON, 3, "Off Campus S1E3");
      });
    }
    if (testHlsBtn) {
      testHlsBtn.addEventListener("click", function() {
        playerLog.innerHTML = "";
        debug.debugClear();
        debug.debugLog("Test LAN HLS");
        setBanner(banner, "info", "Loading LAN sample HLS...");
        testApi().then(function(base) {
          var url = base + "/test/sample.m3u8";
          playerDbg("HLS URL: " + url);
          wireVideoCallbacks();
          player.playUrl(video, url, playerDbg, videoWrap, "LAN sample HLS", "m3u8");
          setBanner(banner, "ok", "Playing LAN sample HLS \u2014 use Play/Pause if needed");
        }).catch(function(err) {
          setBanner(banner, "err", err.message);
          playerDbg("ERROR \u2014 " + err.message);
        });
      });
    }
    if (testMp4Btn) {
      testMp4Btn.addEventListener("click", function() {
        playerLog.innerHTML = "";
        debug.debugClear();
        debug.debugLog("Test LAN MP4");
        setBanner(banner, "info", "Loading LAN sample MP4...");
        testApi().then(function(base) {
          var url = base + "/test/sample.mp4";
          playerDbg("MP4 URL: " + url);
          wireVideoCallbacks();
          player.playDirect(video, url, playerDbg, videoWrap, "LAN sample MP4", false);
          setBanner(banner, "ok", "Playing LAN sample MP4 \u2014 use Play/Pause if needed");
        }).catch(function(err) {
          setBanner(banner, "err", err.message);
          playerDbg("ERROR \u2014 " + err.message);
        });
      });
    }
    function stopPlayback() {
      player.destroyPlayer(video);
      video.removeAttribute("controls");
      video.removeAttribute("crossorigin");
      player.exitPlaybackMode();
      playerDbg("Stopped");
      setBanner(banner, "info", "Stopped \u2014 run a test again.");
    }
    stopBtn.addEventListener("click", stopPlayback);
    var stopBtnBar = document.getElementById("stopBtnBar");
    if (stopBtnBar) stopBtnBar.addEventListener("click", stopPlayback);
    function togglePlayPause() {
      player.togglePlayPause(video, playerDbg);
    }
    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", togglePlayPause);
    }
    document.addEventListener("keydown", function(e) {
      if (e.keyCode === 10009 || e.key === "Back") {
        markCheck(checks.back, true);
      }
      if (player.isMediaPlayPauseKey(e)) {
        togglePlayPause();
      }
    });
    focus.setupFocus(document.body, updateFocusHint);
    testApi().catch(function() {
      setBanner(banner, "warn", "Enter your API LAN URL above, then Save & test.");
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
