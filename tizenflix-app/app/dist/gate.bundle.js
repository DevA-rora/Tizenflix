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
      var DEV_MODE_KEY = "tizenflix.devMode";
      var BACKEND_KEY = "tizenflix.playBackend";
      var PREFERRED_SOURCE_KEY = "tizenflix.preferredSourceId";
      var API_PORT = "8790";
      var PLAY_RESOLVE_TIMEOUT_MS = 9e4;
      var VALID_QUALITY_MODES = ["auto", "high", "medium", "low"];
      function isTizenClient() {
        if (typeof navigator === "undefined") return false;
        var ua = navigator.userAgent || "";
        return ua.indexOf("SMART-TV") !== -1 || ua.indexOf("Tizen") !== -1;
      }
      function getDevMode() {
        try {
          var stored = localStorage.getItem(DEV_MODE_KEY);
          if (stored === "0" || stored === "false") return false;
          if (stored === "1" || stored === "true") return true;
        } catch (err) {
        }
        return true;
      }
      function setDevMode(enabled) {
        try {
          localStorage.setItem(DEV_MODE_KEY, enabled ? "1" : "0");
        } catch (err) {
        }
        return !!enabled;
      }
      function buildPlayQuery(extra) {
        var parts = [];
        if (isTizenClient()) parts.push("profile=tizen");
        var backend = getPlayBackend();
        if (extra && /(?:^|&)backend=/.test(extra)) {
          backend = null;
        }
        if (backend) parts.push("backend=" + backend);
        if (extra) parts.push(extra);
        return parts.length ? parts.join("&") : null;
      }
      function getPlayBackend() {
        try {
          var stored = localStorage.getItem(BACKEND_KEY);
          if (stored === "vidking" || stored === "streamflix" || stored === "auto" || stored === "tmdb-native") return stored;
        } catch (err) {
        }
        return "auto";
      }
      function setPlayBackend(mode) {
        var m = mode === "streamflix" || mode === "auto" || mode === "tmdb-native" ? mode : "vidking";
        try {
          localStorage.setItem(BACKEND_KEY, m);
        } catch (err) {
        }
        return m;
      }
      function getPreferredSourceId() {
        try {
          var stored = localStorage.getItem(PREFERRED_SOURCE_KEY);
          if (stored && typeof stored === "string") return stored;
        } catch (err) {
        }
        return null;
      }
      function setPreferredSourceId(sourceId) {
        try {
          if (!sourceId) localStorage.removeItem(PREFERRED_SOURCE_KEY);
          else localStorage.setItem(PREFERRED_SOURCE_KEY, String(sourceId));
        } catch (err) {
        }
        return sourceId || null;
      }
      function deriveDefaultApi() {
        if (typeof window !== "undefined" && window.location && window.location.hostname) {
          var host = window.location.hostname;
          if (host && host !== "localhost" && host !== "127.0.0.1") {
            return "http://" + host + ":" + API_PORT;
          }
        }
        return "http://localhost:" + API_PORT;
      }
      function getApiBase() {
        try {
          var stored = localStorage.getItem(STORAGE_KEY);
          if (stored) return stored.replace(/\/$/, "");
        } catch (err) {
        }
        return deriveDefaultApi();
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
      function resolvePlay(apiBase, path, query, timeoutMs) {
        var url = apiBase + path;
        if (query) {
          url += (url.indexOf("?") === -1 ? "?" : "&") + query;
        }
        var ms = timeoutMs || PLAY_RESOLVE_TIMEOUT_MS;
        return fetchWithTimeout(url, ms).then(function(res) {
          if (!res.ok) {
            return res.text().then(function(text) {
              throw new Error("Play API " + res.status + (text ? ": " + text.slice(0, 120) : ""));
            });
          }
          return res.json();
        });
      }
      function resolveMovie(apiBase, tmdbId, query, timeoutMs) {
        return resolvePlay(apiBase, "/play/movie/" + encodeURIComponent(tmdbId), query, timeoutMs);
      }
      function resolveTvEpisode(apiBase, tmdbId, season, episode, query, timeoutMs) {
        var path = "/play/tv/" + encodeURIComponent(tmdbId) + "/" + encodeURIComponent(season) + "/" + encodeURIComponent(episode);
        return resolvePlay(apiBase, path, query, timeoutMs);
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
        if (isTizenClient()) {
          ordered = ordered.filter(function(source) {
            return source.type === "m3u8";
          });
        }
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
      function apiGet(path) {
        return fetchWithTimeout(getApiBase() + path, 2e4).then(function(res) {
          if (!res.ok) {
            return res.text().then(function(text) {
              throw new Error("API " + res.status + (text ? ": " + text.slice(0, 120) : ""));
            });
          }
          return res.json();
        });
      }
      module.exports = {
        STORAGE_KEY,
        QUALITY_MODE_KEY,
        DEV_MODE_KEY,
        PLAY_RESOLVE_TIMEOUT_MS,
        deriveDefaultApi,
        API_PORT,
        VALID_QUALITY_MODES,
        isTizenClient,
        getDevMode,
        setDevMode,
        buildPlayQuery,
        getPlayBackend,
        setPlayBackend,
        getPreferredSourceId,
        setPreferredSourceId,
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
        logLine,
        apiGet,
        fetchWithTimeout
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
        var config2 = require_config();
        if (config2.getDevMode()) {
          el.classList.remove("hidden");
        } else {
          el.classList.add("hidden");
        }
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
      var activeSubtitles = [];
      var activeSubtitleIndex = -1;
      function clearSubtitleTracks(video) {
        if (!video) return;
        var tracks = video.querySelectorAll("track");
        for (var i = 0; i < tracks.length; i++) {
          tracks[i].parentNode.removeChild(tracks[i]);
        }
      }
      function applySubtitleTrack(video, trackIndex) {
        if (!video || !video.textTracks) return;
        var i;
        for (i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = i === trackIndex ? "showing" : "hidden";
        }
        activeSubtitleIndex = trackIndex;
      }
      function selectSubtitle(video, trackIndex) {
        if (!video) return;
        if (trackIndex < 0) {
          applySubtitleTrack(video, -1);
          return;
        }
        if (trackIndex >= activeSubtitles.length) return;
        applySubtitleTrack(video, trackIndex);
      }
      function applySubtitles(video, subtitles) {
        activeSubtitles = subtitles || [];
        clearSubtitleTracks(video);
        activeSubtitleIndex = -1;
        var btn = document.getElementById("btnSubtitles");
        if (!activeSubtitles.length) {
          if (btn) btn.classList.add("hidden");
          return;
        }
        var defaultIndex = 0;
        for (var i = 0; i < activeSubtitles.length; i++) {
          var sub = activeSubtitles[i];
          if (!sub || !sub.url) continue;
          var track = document.createElement("track");
          track.kind = "subtitles";
          track.label = sub.label || sub.language || "Sub";
          track.srclang = (sub.language || "en").slice(0, 2);
          track.src = sub.url;
          if (sub.default) defaultIndex = i;
          video.appendChild(track);
        }
        if (btn) {
          btn.classList.remove("hidden");
          btn.textContent = "CC: Off";
        }
      }
      function cycleSubtitles(video) {
        if (!video || !activeSubtitles.length) return;
        var btn = document.getElementById("btnSubtitles");
        var next = activeSubtitleIndex + 1;
        if (next >= activeSubtitles.length) {
          applySubtitleTrack(video, -1);
          if (btn) btn.textContent = "CC: Off";
          return;
        }
        applySubtitleTrack(video, next);
        if (btn) {
          var label = activeSubtitles[next].label || activeSubtitles[next].language || "On";
          btn.textContent = "CC: " + label;
        }
      }
      function bindSubtitleButton(video) {
        var btn = document.getElementById("btnSubtitles");
        if (!btn || btn._tizenflixBound) return;
        btn._tizenflixBound = true;
        btn.addEventListener("click", function() {
          cycleSubtitles(video);
        });
      }
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
      function showPlaybackChrome(videoWrap, title) {
        playbackEntered = false;
        document.body.classList.add("is-playing");
        showVideoWrap(videoWrap);
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
        video.removeAttribute("controls");
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
      function seekBy(video, deltaSeconds) {
        if (!video || !deltaSeconds) return;
        var duration = video.duration;
        if (!duration || !isFinite(duration)) duration = 0;
        var next = video.currentTime + deltaSeconds;
        if (next < 0) next = 0;
        if (duration > 0 && next > duration) next = duration;
        try {
          video.currentTime = next;
        } catch (err) {
          debug2.debugLog("Seek failed: " + err.message);
        }
      }
      function getPlaybackState(video) {
        if (!video) return { currentTime: 0, duration: 0, paused: true };
        return {
          currentTime: video.currentTime || 0,
          duration: video.duration && isFinite(video.duration) ? video.duration : 0,
          paused: !!video.paused
        };
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
        showPlaybackChrome,
        exitPlaybackMode,
        applySubtitles,
        selectSubtitle,
        bindSubtitleButton,
        cycleSubtitles,
        seekBy,
        getPlaybackState,
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

  // app/js/core/motion.js
  var require_motion = __commonJS({
    "app/js/core/motion.js"(exports, module) {
      var config2 = require_config();
      var BROWSER = {
        transformMs: 250,
        opacityMs: 250,
        scrollMs: 280,
        mainScrollMs: 300,
        heroDebounceMs: 150,
        fadeMs: 120,
        heroBackdropMs: 400
      };
      var TV = {
        transformMs: 150,
        opacityMs: 150,
        scrollMs: 150,
        mainScrollMs: 140,
        heroDebounceMs: 80,
        fadeMs: 80,
        heroBackdropMs: 250
      };
      var tvPerfForced = null;
      function queryTvPerfOverride() {
        if (typeof window === "undefined" || !window.location || !window.location.search) return false;
        var search = window.location.search;
        return search.indexOf("tvPerf=1") !== -1 || search.indexOf("tvPerf=true") !== -1;
      }
      function isTvPerfMode() {
        if (tvPerfForced !== null) return tvPerfForced;
        if (queryTvPerfOverride()) return true;
        return config2.isTizenClient();
      }
      function setTvPerfMode(enabled) {
        tvPerfForced = !!enabled;
      }
      function getMotionProfile() {
        return isTvPerfMode() ? TV : BROWSER;
      }
      function prefersReducedMotion() {
        return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }
      function shouldSnapScroll(distance) {
        if (prefersReducedMotion()) return true;
        if (isTvPerfMode() && Math.abs(distance) > 400) return true;
        return false;
      }
      function applyBodyClass() {
        if (typeof document === "undefined" || !document.body) return;
        document.body.classList.toggle("tv-perf", isTvPerfMode());
      }
      module.exports = {
        BROWSER,
        TV,
        isTvPerfMode,
        setTvPerfMode,
        getMotionProfile,
        prefersReducedMotion,
        shouldSnapScroll,
        applyBodyClass
      };
    }
  });

  // app/js/core/focus.js
  var require_focus = __commonJS({
    "app/js/core/focus.js"(exports, module) {
      var motion = require_motion();
      var FOCUS_SELECTOR = "button:not(:disabled), input[type='text']:not(:disabled), a[href], [tabindex='0']";
      var onFocusChange = null;
      var currentEl = null;
      var lastSidebarEl = null;
      var rememberedMainEl = null;
      var keyHandler = null;
      var lastFocusRowId = null;
      var lastSearchLeftEl = null;
      var scrollAnimGen = 0;
      function getFocusables(root) {
        if (!root) return [];
        var nodes = root.querySelectorAll(FOCUS_SELECTOR);
        var list = [];
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el.disabled) continue;
          if (el.offsetParent === null && el !== currentEl) continue;
          list.push(el);
        }
        return list;
      }
      function labelFor(el) {
        if (!el) return "";
        if (el.id === "apiBaseInput") return "API URL";
        if (el.id === "saveApiBtn") return "Save & test";
        if (el.id === "devModeBtn") return "Dev mode";
        if (el.id === "detailPlayBtn") return "Play";
        if (el.id === "detailMyListBtn") return "My List";
        if (el.id === "detailBackBtn") return "Back";
        if (el.id === "btnStop") return "Stop";
        if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
        var text = (el.textContent || "").trim();
        if (text) return text.slice(0, 40);
        return el.tagName;
      }
      function clearAllFocus() {
        var all = document.querySelectorAll(".tv-focus");
        for (var i = 0; i < all.length; i++) {
          all[i].classList.remove("tv-focus");
        }
      }
      function isInSidebar(el) {
        var sidebar = document.getElementById("sidebar");
        return !!(sidebar && el && sidebar.contains(el));
      }
      function getSidebarFocusables() {
        var sidebar = document.getElementById("sidebar");
        return sidebar ? getFocusables(sidebar) : [];
      }
      function getMainRoot() {
        return document.getElementById("main");
      }
      function resetMainScroll() {
        var main = getMainRoot();
        if (main) main.scrollTop = 0;
        lastFocusRowId = null;
        resetAllTrackOffsets();
      }
      function resetAllTrackOffsets() {
        var tracks = document.querySelectorAll(".row-track");
        for (var i = 0; i < tracks.length; i++) {
          setTrackOffset(tracks[i], 0);
        }
      }
      function getTrackOffset(track) {
        if (!track) return 0;
        if (typeof track._scrollX === "number") return track._scrollX;
        return 0;
      }
      function setTrackOffset(track, offset) {
        if (!track) return;
        var x = Math.max(0, offset);
        track._scrollX = x;
        var transform = "translate3d(" + -x + "px, 0, 0)";
        track.style.webkitTransform = transform;
        track.style.transform = transform;
      }
      function getScrollElements(el) {
        var track = el ? el.closest(".row-track") : null;
        if (!track) return { track: null, outer: null };
        var outer = track.parentElement;
        if (outer && outer.classList.contains("row-track-outer")) {
          return { track, outer };
        }
        return { track, outer: track };
      }
      function getMaxTrackOffset(track, outer) {
        if (!track || !outer) return 0;
        return Math.max(0, track.scrollWidth - outer.clientWidth);
      }
      function scrollIntoView(el) {
        if (!el || !el.getBoundingClientRect) return;
        var main = getMainRoot();
        if (!main) {
          if (el.scrollIntoView) {
            try {
              el.scrollIntoView({ block: "nearest", inline: "nearest" });
            } catch (err) {
              el.scrollIntoView(false);
            }
          }
          return;
        }
        var elRect = el.getBoundingClientRect();
        var mainRect = main.getBoundingClientRect();
        if (elRect.bottom > mainRect.bottom - 16) {
          main.scrollTop += elRect.bottom - mainRect.bottom + 32;
        } else if (elRect.top < mainRect.top + 16) {
          main.scrollTop = Math.max(0, main.scrollTop - (mainRect.top - elRect.top + 32));
        }
      }
      function buildFocusMeta(el) {
        var rowId = getFocusRowId(el);
        var isCard = !!(el && el.classList && el.classList.contains("card"));
        return {
          rowId,
          isCard,
          tmdbId: isCard ? el.getAttribute("data-tmdb-id") : null,
          mediaType: isCard ? el.getAttribute("data-media-type") : null,
          label: labelFor(el)
        };
      }
      function setSidebarExpanded(expanded) {
        if (document.body) {
          if (expanded) document.body.classList.add("sidebar-expanded");
          else document.body.classList.remove("sidebar-expanded");
        }
      }
      function isInSpotlightRow(el) {
        if (!el || !el.classList || !el.classList.contains("card")) return false;
        return !!el.closest(".row-spotlight");
      }
      function updateSpotlightMode(el) {
        var rows = document.querySelectorAll(".row-spotlight");
        for (var i = 0; i < rows.length; i++) {
          rows[i].classList.remove("is-active");
          var cards = rows[i].querySelectorAll(".card-spotlight");
          for (var c = 0; c < cards.length; c++) {
            if (cards[c] === el) continue;
            var posterEl = cards[c].querySelector(".card-poster");
            var posterUrl = cards[c].getAttribute("data-poster");
            if (posterEl && posterUrl) {
              posterEl.style.backgroundImage = "url('" + posterUrl.replace(/'/g, "%27") + "')";
            }
          }
        }
        if (isInSpotlightRow(el)) {
          document.body.classList.add("home-spotlight-focus");
          var row = el.closest(".row-spotlight");
          if (row) row.classList.add("is-active");
          var posterEl = el.querySelector(".card-poster");
          var backdropUrl = el.getAttribute("data-backdrop") || el.getAttribute("data-poster");
          if (posterEl && backdropUrl) {
            posterEl.classList.add("is-swapping");
            posterEl.style.backgroundImage = "url('" + backdropUrl.replace(/'/g, "%27") + "')";
            requestAnimationFrame(function() {
              posterEl.classList.remove("is-swapping");
            });
          }
        } else {
          document.body.classList.remove("home-spotlight-focus");
        }
      }
      function animateTrackOffset(track, outer, targetOffset, duration, onComplete) {
        if (!track) return;
        var maxOffset = getMaxTrackOffset(track, outer);
        targetOffset = Math.max(0, Math.min(targetOffset, maxOffset));
        var start = getTrackOffset(track);
        var distance = targetOffset - start;
        if (Math.abs(distance) < 2) {
          setTrackOffset(track, targetOffset);
          if (onComplete) onComplete();
          return;
        }
        if (motion.prefersReducedMotion()) {
          setTrackOffset(track, targetOffset);
          if (onComplete) onComplete();
          return;
        }
        scrollAnimGen += 1;
        var gen = scrollAnimGen;
        var profile = motion.getMotionProfile();
        duration = duration || profile.scrollMs;
        var startTime = null;
        function step(timestamp) {
          if (gen !== scrollAnimGen) return;
          if (!startTime) startTime = timestamp;
          var elapsed = timestamp - startTime;
          var progress = Math.min(elapsed / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          setTrackOffset(track, start + distance * eased);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else if (onComplete) {
            onComplete();
          }
        }
        requestAnimationFrame(step);
      }
      function animateMainScroll(main, targetScroll, duration) {
        if (!main) return;
        targetScroll = Math.max(0, targetScroll);
        var start = main.scrollTop;
        var distance = targetScroll - start;
        if (Math.abs(distance) < 2) return;
        if (motion.prefersReducedMotion() || motion.shouldSnapScroll(distance)) {
          main.scrollTop = targetScroll;
          return;
        }
        scrollAnimGen += 1;
        var gen = scrollAnimGen;
        var profile = motion.getMotionProfile();
        duration = duration || profile.mainScrollMs;
        var startTime = null;
        function step(timestamp) {
          if (gen !== scrollAnimGen) return;
          if (!startTime) startTime = timestamp;
          var elapsed = timestamp - startTime;
          var progress = Math.min(elapsed / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          main.scrollTop = start + distance * eased;
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }
      function getCardOffsetInScroller(track, card) {
        if (!track || !card) return 0;
        return card.offsetLeft;
      }
      function getHorizontalScrollTarget(track, outer, card, padding) {
        if (!track || !card || !outer) return getTrackOffset(track);
        var cardLeft = getCardOffsetInScroller(track, card);
        var cardWidth = card.offsetWidth;
        var viewWidth = outer.clientWidth;
        var scrollLeft = getTrackOffset(track);
        var visibleLeft = cardLeft - scrollLeft;
        var visibleRight = visibleLeft + cardWidth;
        if (visibleLeft < padding) {
          return cardLeft - padding;
        }
        if (visibleRight > viewWidth - padding) {
          return cardLeft + cardWidth - viewWidth + padding;
        }
        return scrollLeft;
      }
      function scrollSpotlightRowToTop(el) {
        var row = el.closest(".row-spotlight");
        var main = getMainRoot();
        if (!row || !main) return;
        var profile = motion.getMotionProfile();
        animateMainScroll(main, Math.max(0, row.offsetTop - 48), profile.mainScrollMs);
      }
      function getSpotlightScrollPadding(el) {
        return indexInRow(el) === 0 ? 0 : 40;
      }
      function scrollRowIntoView(el, onComplete) {
        if (!el || !el.classList.contains("card")) {
          if (onComplete) onComplete();
          return;
        }
        var scrollEls = getScrollElements(el);
        var track = scrollEls.track;
        var outer = scrollEls.outer;
        if (!track || !outer) {
          if (onComplete) onComplete();
          return;
        }
        var profile = motion.getMotionProfile();
        var padding = isInSpotlightRow(el) ? getSpotlightScrollPadding(el) : 56;
        var target;
        var duration = isInSpotlightRow(el) ? profile.scrollMs + 40 : profile.scrollMs;
        if (isInSpotlightRow(el) && el.classList.contains("tv-focus")) {
          target = Math.max(0, getCardOffsetInScroller(track, el) - padding);
        } else {
          target = getHorizontalScrollTarget(track, outer, el, padding);
        }
        animateTrackOffset(track, outer, target, duration, onComplete);
      }
      function syncSpotlightLayout(el) {
        if (!isInSpotlightRow(el)) return;
        var row = el.closest(".row-spotlight");
        if (row && typeof row._syncSpotlightLayout === "function") {
          row._syncSpotlightLayout();
        }
      }
      function scheduleScrollAfterLayout(el, rowId, rowChanged) {
        scrollAnimGen += 1;
        var gen = scrollAnimGen;
        var isSpotlight = isInSpotlightRow(el);
        function afterHorizontalScroll() {
          if (gen !== scrollAnimGen || currentEl !== el) return;
          if (isSpotlight) syncSpotlightLayout(el);
        }
        function runScroll() {
          if (gen !== scrollAnimGen || currentEl !== el) return;
          if (el.classList.contains("card")) {
            scrollRowIntoView(el, afterHorizontalScroll);
          }
          if (isSpotlight) {
            if (rowChanged) scrollSpotlightRowToTop(el);
          } else {
            scrollIntoView(el);
          }
        }
        requestAnimationFrame(runScroll);
      }
      function focusElement(el) {
        if (!el) return false;
        clearAllFocus();
        currentEl = el;
        el.classList.add("tv-focus");
        var rowId = getFocusRowId(el);
        var rowChanged = rowId !== lastFocusRowId;
        lastFocusRowId = rowId;
        setSidebarExpanded(isInSidebar(el));
        updateSpotlightMode(el);
        scheduleScrollAfterLayout(el, rowId, rowChanged);
        if (isInSidebar(el)) lastSidebarEl = el;
        if (onFocusChange) onFocusChange(buildFocusMeta(el));
        return true;
      }
      function getFocusRowContainer(el) {
        if (!el) return null;
        var row = el.closest("[data-focus-row]");
        if (row) return row;
        var track = el.closest(".row-track");
        if (track && track.parentElement) return track.parentElement;
        return null;
      }
      function getFocusRowId(el) {
        var row = getFocusRowContainer(el);
        return row ? row.getAttribute("data-focus-row") : null;
      }
      function getRowFocusables(rowId) {
        var main = getMainRoot();
        if (!main || !rowId) return [];
        var row = main.querySelector('[data-focus-row="' + rowId + '"]');
        if (!row) return [];
        if (row.getAttribute("data-focus-row") === "hero") {
          return getFocusables(row);
        }
        var track = row.querySelector(".row-track");
        return track ? getFocusables(track) : getFocusables(row);
      }
      function getOrderedRowIds() {
        var main = getMainRoot();
        if (!main) return [];
        var nodes = main.querySelectorAll("[data-focus-row]");
        var ids = [];
        for (var i = 0; i < nodes.length; i++) {
          var id = nodes[i].getAttribute("data-focus-row");
          if (id && ids.indexOf(id) === -1) ids.push(id);
        }
        return ids;
      }
      function indexInRow(el) {
        var rowId = getFocusRowId(el);
        var items = getRowFocusables(rowId);
        for (var i = 0; i < items.length; i++) {
          if (items[i] === el) return i;
        }
        return 0;
      }
      function handleSidebarNav(el, dir) {
        var nav = getSidebarFocusables();
        if (!nav.length) return null;
        var idx = nav.indexOf(el);
        if (idx === -1) idx = 0;
        if (dir === "up") return nav[(idx - 1 + nav.length) % nav.length];
        if (dir === "down") return nav[(idx + 1) % nav.length];
        return el;
      }
      function getCrossTargetRow(rowId, col) {
        var main = getMainRoot();
        if (!main || !rowId) return null;
        var row = main.querySelector('[data-focus-row="' + rowId + '"]');
        if (!row) return null;
        var track = row.querySelector(".row-track");
        var items = track ? getFocusables(track) : getFocusables(row);
        if (!items.length) return null;
        return items[Math.min(col, items.length - 1)];
      }
      function handleMainLeft(el) {
        var items = getRowFocusables(getFocusRowId(el));
        var idx = indexInRow(el);
        if (idx > 0) return items[idx - 1];
        var crossLeft = el.getAttribute("data-cross-left");
        if (crossLeft) {
          var target = getCrossTargetRow(crossLeft, idx);
          if (target) return target;
          if (lastSearchLeftEl && document.body.contains(lastSearchLeftEl)) {
            return lastSearchLeftEl;
          }
          var fallback = getCrossTargetRow("osk-3", 0);
          if (fallback) return fallback;
        }
        var nav = getSidebarFocusables();
        if (lastSidebarEl && nav.indexOf(lastSidebarEl) !== -1) return lastSidebarEl;
        return nav.length ? nav[0] : el;
      }
      function handleMainRight(el) {
        var items = getRowFocusables(getFocusRowId(el));
        var idx = indexInRow(el);
        if (idx < items.length - 1) return items[idx + 1];
        var crossRight = el.getAttribute("data-cross-right");
        if (crossRight) {
          if (el.classList.contains("osk-key") || el.classList.contains("search-suggestion")) {
            lastSearchLeftEl = el;
          }
          var target = getCrossTargetRow(crossRight, idx);
          if (target) return target;
        }
        return el;
      }
      function getLinearMainFocusables() {
        var main = getMainRoot();
        return main ? getFocusables(main) : [];
      }
      function handleMainVerticalLinear(el, dir) {
        var items = getLinearMainFocusables();
        var idx = items.indexOf(el);
        if (idx === -1) return el;
        if (dir === "up") return idx > 0 ? items[idx - 1] : el;
        if (dir === "down") return idx < items.length - 1 ? items[idx + 1] : el;
        return el;
      }
      function handleMainVertical(el, dir) {
        var rowId = getFocusRowId(el);
        if (!rowId) return handleMainVerticalLinear(el, dir);
        var rows = getOrderedRowIds();
        var rowIdx = rows.indexOf(rowId);
        if (rowIdx === -1) return el;
        var targetIdx = dir === "up" ? rowIdx - 1 : rowIdx + 1;
        if (targetIdx < 0 || targetIdx >= rows.length) return el;
        var targetItems = getRowFocusables(rows[targetIdx]);
        if (!targetItems.length) return el;
        var col = indexInRow(el);
        return targetItems[Math.min(col, targetItems.length - 1)];
      }
      function focusDefaultMain(selector) {
        resetMainScroll();
        var main = getMainRoot();
        if (!main) return false;
        var el = null;
        if (selector) {
          el = main.querySelector(selector) || document.querySelector(selector);
        }
        if (!el) el = main.querySelector(".hero .btn-play");
        if (!el) el = main.querySelector(".card");
        if (!el) {
          var focusables = getFocusables(main);
          el = focusables.length ? focusables[0] : null;
        }
        return el ? focusElement(el) : false;
      }
      function rememberMainFocus() {
        if (currentEl && !isInSidebar(currentEl)) {
          rememberedMainEl = currentEl;
        }
      }
      function restoreMainFocus() {
        if (rememberedMainEl && document.body.contains(rememberedMainEl)) {
          return focusElement(rememberedMainEl);
        }
        return focusDefaultMain();
      }
      var SCREEN_FOCUS = {
        home: [".hero .btn-play", ".card", "button"],
        trending: [".card", "button"],
        tv: [".card", "button"],
        movies: [".card", "button"],
        search: [".osk-key", "button"],
        settings: ["#apiBaseInput", "button"],
        mylist: [".card", "button"],
        random: ["button"],
        categories: ["button"]
      };
      function afterScreenRender(screenName) {
        resetMainScroll();
        var selectors = SCREEN_FOCUS[screenName];
        if (selectors) {
          var main = getMainRoot();
          if (main) {
            for (var i = 0; i < selectors.length; i++) {
              var el = main.querySelector(selectors[i]);
              if (el) {
                focusElement(el);
                return;
              }
            }
          }
        }
        if (screenName !== "detail-movie" && screenName !== "detail-tv") {
          focusDefaultMain();
        }
      }
      function onKeyDown(e) {
        if (document.body.classList.contains("is-playing")) return;
        var key = e.key || "";
        var code = e.keyCode;
        var isLeft = key === "ArrowLeft" || code === 37;
        var isRight = key === "ArrowRight" || code === 39;
        var isUp = key === "ArrowUp" || code === 38;
        var isDown = key === "ArrowDown" || code === 40;
        var isEnter = code === 13 || key === "Enter";
        if (!currentEl) {
          focusDefaultMain();
          if (isLeft || isRight || isUp || isDown || isEnter) e.preventDefault();
          return;
        }
        if (isEnter) {
          if (currentEl.click) currentEl.click();
          e.preventDefault();
          return;
        }
        var next = null;
        var inSidebar = isInSidebar(currentEl);
        if (inSidebar) {
          if (isUp) next = handleSidebarNav(currentEl, "up");
          else if (isDown) next = handleSidebarNav(currentEl, "down");
          else if (isRight) {
            setSidebarExpanded(false);
            focusDefaultMain();
            e.preventDefault();
            return;
          }
        } else {
          if (isLeft) next = handleMainLeft(currentEl);
          else if (isRight) next = handleMainRight(currentEl);
          else if (isUp) next = handleMainVertical(currentEl, "up");
          else if (isDown) next = handleMainVertical(currentEl, "down");
        }
        if (next && next !== currentEl) {
          focusElement(next);
        }
        if (isLeft || isRight || isUp || isDown) e.preventDefault();
      }
      function init2(cb) {
        if (keyHandler) {
          document.removeEventListener("keydown", keyHandler);
        }
        onFocusChange = cb || null;
        keyHandler = onKeyDown;
        document.addEventListener("keydown", keyHandler);
      }
      function destroy() {
        if (keyHandler) {
          document.removeEventListener("keydown", keyHandler);
          keyHandler = null;
        }
        clearAllFocus();
        currentEl = null;
        lastFocusRowId = null;
        setSidebarExpanded(false);
        document.body.classList.remove("home-spotlight-focus");
      }
      function setupFocus(root, onFocusChangeCb) {
        init2(onFocusChangeCb);
        var list = getFocusables(root);
        if (list.length) focusElement(list[0]);
      }
      module.exports = {
        init: init2,
        destroy,
        focusElement,
        focusDefaultMain,
        rememberMainFocus,
        restoreMainFocus,
        resetMainScroll,
        afterScreenRender,
        getFocusables,
        setupFocus
      };
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
