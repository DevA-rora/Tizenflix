var TizenflixApp = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

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

  // app/js/core/router.js
  var require_router = __commonJS({
    "app/js/core/router.js"(exports, module) {
      var focus = require_focus();
      var stack = [];
      var screens = {};
      var rootEl = null;
      var onFocusHint = null;
      function register(name, screen) {
        screens[name] = screen;
      }
      function current() {
        return stack.length ? stack[stack.length - 1] : null;
      }
      function render() {
        if (!rootEl) return;
        var name = current();
        var screen = name ? screens[name] : null;
        rootEl.innerHTML = "";
        if (screen && typeof screen.render === "function") {
          screen.render(rootEl);
        }
        if (onFocusHint) {
          focus.setupFocus(document.body, onFocusHint);
        }
      }
      function navigate(name, params) {
        var screen = screens[name];
        if (!screen) return;
        stack.push(name);
        if (typeof screen.onEnter === "function") {
          screen.onEnter(params || {});
        }
        render();
      }
      function replace(name, params) {
        stack = [];
        navigate(name, params);
      }
      function back() {
        if (stack.length <= 1) return false;
        var leaving = stack.pop();
        var screen = screens[leaving];
        if (screen && typeof screen.onLeave === "function") {
          screen.onLeave();
        }
        render();
        return true;
      }
      function init(options) {
        rootEl = options.root;
        onFocusHint = options.onFocusHint || null;
        if (options.initial) {
          replace(options.initial);
        }
      }
      module.exports = {
        register,
        navigate,
        replace,
        back,
        current,
        init
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
        el.classList.remove("hidden");
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

  // app/js/core/config.js
  var require_config = __commonJS({
    "app/js/core/config.js"(exports, module) {
      var STORAGE_KEY = "tizenflix.apiBase";
      var QUALITY_MODE_KEY = "tizenflix.qualityMode";
      var API_PORT = "8790";
      var PLAY_RESOLVE_TIMEOUT_MS = 9e4;
      var VALID_QUALITY_MODES = ["auto", "high", "medium", "low"];
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
        PLAY_RESOLVE_TIMEOUT_MS,
        deriveDefaultApi,
        API_PORT,
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
        logLine,
        apiGet,
        fetchWithTimeout
      };
    }
  });

  // app/js/player/player.js
  var require_player = __commonJS({
    "app/js/player/player.js"(exports, module) {
      var config = require_config();
      var debug = require_debug();
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
              debug.debugLog(msg2);
              if (onError) onError(msg2);
            });
          }
        } catch (e) {
          var msg = "play() threw: " + e.message;
          debug.debugLog(msg);
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
          debug.debugLog("Entered fullscreen on playing");
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
            debug.debugLog(msg);
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
              debug.debugLog(msg);
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
        var m = mode || config.getQualityMode();
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
        var base = config.getApiBase();
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
            debug.debugLog("HLS buffer primed " + Math.floor(ahead) + "s (" + (label || "ready") + ")");
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
          debug.debugLog("HLS prime timeout \u2014 starting with " + Math.floor(ahead) + "s buffered");
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
            debug.debugLog(msg);
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
        debug.debugLog(msg);
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
        debug.debugLog(msg);
        if (onLog) onLog(msg);
      }
      function playHlsJs(video, url, onLog, videoWrap, title, session, onFatal) {
        debug.debugLog("Player path: HLS.js");
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
          debug.debugLog("HLS.js manifest parsed");
          if (onLog) onLog("HLS.js manifest parsed \u2014 buffering ahead");
          applyQualityMode(hlsInstance, config.getQualityMode());
          setupPlaybackHealthReport(video, session);
          startHlsPlaybackWhenBuffered(video, videoWrap, title, onLog, session, hlsInstance);
        });
        hlsInstance.on(Hls.Events.LEVEL_LOADED, function(event, data) {
          if (!isActiveSession(session) || !data || !data.details) return;
          var h = data.details.height;
          var w = data.details.width;
          if (w && h) {
            var q = "Quality: " + w + "x" + h;
            debug.debugLog(q);
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
            debug.debugLog("HLS network error \u2014 retry " + fatalRetries);
            if (onLog) onLog("HLS network error \u2014 retry " + fatalRetries);
            try {
              hlsInstance.startLoad(-1);
            } catch (e) {
            }
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && fatalRetries < 3) {
            fatalRetries += 1;
            debug.debugLog("HLS media error \u2014 recover " + fatalRetries);
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
        debug.debugLog("Player path: native HLS");
        if (onLog) onLog("Player path: native HLS (wait up to 12s, then HLS.js fallback)");
        setCrossOrigin(video, true);
        video.src = url;
        function fallback(reason) {
          if (!isActiveSession(session) || !onStallFallback) return;
          debug.debugLog(reason);
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
              debug.debugLog("Native HLS: networkState=no_source");
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
        var type = streamType || config.detectStreamType(url);
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
                debug.debugLog("HLS.js not available for fallback");
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
          debug.debugLog("No HLS player available");
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
        debug.debugLog("Player path: direct " + config.detectStreamType(url));
        if (onLog) onLog("Player path: direct " + config.detectStreamType(url));
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
          debug.debugLog("No sources to play");
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
            debug.debugLog(reason);
            if (onLog) onLog(reason);
          }
          if (index >= sources.length) {
            var done = "All sources failed \u2014 CDN may be blocking playback";
            debug.debugLog(done);
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
          debug.debugLog(label);
          if (onLog) onLog(label);
          playUrlAttempt(video, source.url, onLog, videoWrap, title, source.type, function(fatalMsg) {
            tryNext(fatalMsg);
          });
        }
        tryNext();
      }
      function logVideoState(video, label) {
        if (!video) return;
        debug.debugLog((label || "video") + " " + debug.formatVideoState(video));
      }
      function togglePlayPause(video, onLog) {
        if (!video) return;
        if (video.paused) {
          safePlay(video, function(msg) {
            if (onLog) onLog(msg);
          });
          if (onLog) onLog("Resume");
          debug.debugLog("Resume");
        } else {
          video.pause();
          if (onLog) onLog("Paused");
          debug.debugLog("Paused");
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

  // app/js/services/api.js
  var require_api = __commonJS({
    "app/js/services/api.js"(exports, module) {
      var config = require_config();
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
        getBase,
        setBase: config.setApiBase,
        health,
        browseRows,
        browseRow,
        search,
        getMovie,
        getTv,
        getSeasons,
        getEpisodes,
        resolveMovie,
        resolveTvEpisode,
        sourcesForPlay
      };
    }
  });

  // app/js/services/playback.js
  var require_playback = __commonJS({
    "app/js/services/playback.js"(exports, module) {
      var api = require_api();
      var player = require_player();
      var debug = require_debug();
      function playResolved(play, title, onStatus) {
        var video = document.getElementById("video");
        var wrap = document.getElementById("videoWrap");
        if (!video || !wrap) return Promise.reject(new Error("Video element missing"));
        var sources = api.sourcesForPlay(play);
        if (!sources.length) {
          var msg = play.warnings && play.warnings.length ? play.warnings.join("; ") : "No playable sources";
          return Promise.reject(new Error(msg));
        }
        wrap.classList.remove("hidden");
        var titleEl = document.getElementById("playbackTitle");
        if (titleEl) titleEl.textContent = title || play.title || "";
        debug.debugClear();
        debug.debugLog("Playing: " + (title || play.title || ""));
        function log(msg2) {
          debug.debugLog(msg2);
          if (onStatus) onStatus(msg2);
        }
        player.playSources(video, sources, log, wrap, title || play.title || "Playback");
        return Promise.resolve();
      }
      function playMovie(tmdbId, title, onStatus) {
        if (onStatus) onStatus("Resolving movie...");
        return api.resolveMovie(tmdbId).then(function(play) {
          return playResolved(play, title, onStatus);
        });
      }
      function playTvEpisode(tmdbId, season, episode, title, onStatus) {
        if (onStatus) onStatus("Resolving episode...");
        return api.resolveTvEpisode(tmdbId, season, episode).then(function(play) {
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
        playResolved,
        playMovie,
        playTvEpisode,
        stop
      };
    }
  });

  // app/js/components/hero.js
  var require_hero = __commonJS({
    "app/js/components/hero.js"(exports, module) {
      function escapeHtml(text) {
        if (!text) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }
      function truncate(text, max) {
        if (!text) return "";
        if (text.length <= max) return text;
        return text.slice(0, max - 1).trim() + "\u2026";
      }
      function renderHero(item, handlers) {
        var type = item.type || item.mediaType || item.media_type || "movie";
        var badge = type === "tv" ? "N SERIES" : "FILM";
        var backdrop = item.backdrop || "";
        var title = item.title || item.name || "Untitled";
        var overview = truncate(item.overview || "", 220);
        var rank = item.rank ? "#" + item.rank + " in " + (type === "tv" ? "TV Shows" : "Movies") + " Today" : "";
        var el = document.createElement("section");
        el.className = "hero";
        el.setAttribute("data-tmdb-id", String(item.id));
        el.setAttribute("data-media-type", type);
        el.innerHTML = `<div class="hero-backdrop" style="background-image:url('` + escapeHtml(backdrop) + `')"></div><div class="hero-gradient"></div><div class="hero-content"><div class="hero-badge"><span class="hero-n">N</span> ` + (type === "tv" ? "SERIES" : "FILM") + '</div><h1 class="hero-title">' + escapeHtml(title) + "</h1>" + (rank ? '<div class="hero-rank"><span class="top10">TOP 10</span> ' + escapeHtml(rank) + "</div>" : "") + '<p class="hero-overview">' + escapeHtml(overview) + '</p><div class="hero-actions"><button type="button" class="btn btn-play focusable" data-action="play">\u25B6 Play</button><button type="button" class="btn btn-info focusable" data-action="info">More info</button></div></div>';
        var playBtn = el.querySelector('[data-action="play"]');
        var infoBtn = el.querySelector('[data-action="info"]');
        if (playBtn && handlers && handlers.onPlay) {
          playBtn.addEventListener("click", function() {
            handlers.onPlay(item);
          });
        }
        if (infoBtn && handlers && handlers.onInfo) {
          infoBtn.addEventListener("click", function() {
            handlers.onInfo(item);
          });
        }
        return el;
      }
      module.exports = {
        renderHero
      };
    }
  });

  // app/js/components/card.js
  var require_card = __commonJS({
    "app/js/components/card.js"(exports, module) {
      function escapeHtml(text) {
        if (!text) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }
      function createCard(item, onSelect) {
        var type = item.type || item.mediaType || item.media_type || "movie";
        var title = item.title || item.name || "Untitled";
        var poster = item.poster || "";
        var el = document.createElement("button");
        el.type = "button";
        el.className = "card focusable";
        el.setAttribute("data-tmdb-id", String(item.id));
        el.setAttribute("data-media-type", type);
        el.setAttribute("aria-label", title);
        el.innerHTML = `<div class="card-poster" style="background-image:url('` + escapeHtml(poster) + `')"><span class="card-n">N</span></div><span class="card-title">` + escapeHtml(title) + "</span>";
        el.addEventListener("click", function() {
          if (onSelect) onSelect(item);
        });
        return el;
      }
      module.exports = {
        createCard
      };
    }
  });

  // app/js/components/row.js
  var require_row = __commonJS({
    "app/js/components/row.js"(exports, module) {
      var card = require_card();
      function createRow(title, items, onSelect) {
        var row = document.createElement("section");
        row.className = "content-row";
        var heading = document.createElement("h2");
        heading.className = "row-title";
        heading.textContent = title;
        row.appendChild(heading);
        var track = document.createElement("div");
        track.className = "row-track";
        for (var i = 0; i < items.length; i++) {
          track.appendChild(card.createCard(items[i], onSelect));
        }
        row.appendChild(track);
        return row;
      }
      module.exports = {
        createRow
      };
    }
  });

  // app/js/screens/home.js
  var require_home = __commonJS({
    "app/js/screens/home.js"(exports, module) {
      var api = require_api();
      var router = require_router();
      var hero = require_hero();
      var row = require_row();
      var playback = require_playback();
      var viewMode = "home";
      function setMode(mode) {
        viewMode = mode || "home";
      }
      function filterRows(rows) {
        if (viewMode === "trending") {
          return rows.filter(function(r) {
            return r.id.indexOf("trending") !== -1;
          });
        }
        if (viewMode === "tv") {
          return rows.filter(function(r) {
            return r.id.indexOf("-tv") !== -1;
          });
        }
        if (viewMode === "movies") {
          return rows.filter(function(r) {
            return r.id.indexOf("-movies") !== -1;
          });
        }
        return rows;
      }
      function openItem(item) {
        if (item.type === "tv") {
          router.navigate("detail-tv", { tmdbId: item.id, title: item.title });
        } else {
          router.navigate("detail-movie", { tmdbId: item.id, title: item.title });
        }
      }
      function playItem(item, onStatus) {
        if (item.type === "tv") {
          return playback.playTvEpisode(item.id, 1, 1, item.title, onStatus);
        }
        return playback.playMovie(item.id, item.title, onStatus);
      }
      function showError(el, message) {
        var banner = document.createElement("div");
        banner.className = "error-banner";
        banner.textContent = message;
        el.appendChild(banner);
      }
      function loadContent(el) {
        api.browseRows().then(function(data) {
          var rows = filterRows(data.rows || []);
          if (!rows.length) {
            showError(el, "No browse rows available.");
            return null;
          }
          var heroRowId = "trending-tv";
          for (var h = 0; h < rows.length; h++) {
            if (rows[h].id === "trending-tv") {
              heroRowId = rows[h].id;
              break;
            }
          }
          return api.browseRow(heroRowId).then(function(heroData) {
            return { rows, heroItems: heroData.items || [] };
          });
        }).then(function(bundle) {
          if (!bundle) return;
          el.innerHTML = "";
          if (bundle.heroItems.length && viewMode === "home") {
            var featured = bundle.heroItems[0];
            featured.rank = 1;
            el.appendChild(
              hero.renderHero(featured, {
                onPlay: function(item) {
                  playItem(item, window.TizenflixApp && window.TizenflixApp.showStatus).catch(function(err) {
                    if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
                  });
                },
                onInfo: openItem
              })
            );
          }
          var pending = bundle.rows.length;
          var done = 0;
          function rowLoaded() {
            done += 1;
          }
          for (var i = 0; i < bundle.rows.length; i++) {
            (function(rowDef) {
              api.browseRow(rowDef.id).then(function(rowData) {
                var items = rowData.items || [];
                if (items.length) {
                  el.appendChild(row.createRow(rowDef.title, items, openItem));
                }
              }).catch(function() {
              }).then(rowLoaded);
            })(bundle.rows[i]);
          }
        }).catch(function(err) {
          el.innerHTML = "";
          var msg = err.message || String(err);
          if (msg.indexOf("503") !== -1 || msg.indexOf("TMDB") !== -1) {
            showError(
              el,
              "Catalog unavailable \u2014 set TMDB_API_KEY in tizenflix-api/.env and restart the API. Browser: use Settings to point API URL to http://localhost:8790"
            );
          } else {
            showError(el, "Could not load catalog: " + msg);
          }
        });
      }
      function render(container) {
        var el = document.createElement("div");
        el.className = "screen screen-home";
        el.innerHTML = '<div class="loading-msg">Loading catalog\u2026</div>';
        container.appendChild(el);
        loadContent(el);
      }
      module.exports = {
        setMode,
        render
      };
    }
  });

  // app/js/screens/search.js
  var require_search = __commonJS({
    "app/js/screens/search.js"(exports, module) {
      var api = require_api();
      var router = require_router();
      var card = require_card();
      function openItem(item) {
        if (item.type === "tv") {
          router.navigate("detail-tv", { tmdbId: item.id, title: item.title });
        } else {
          router.navigate("detail-movie", { tmdbId: item.id, title: item.title });
        }
      }
      function render(container) {
        var el = document.createElement("div");
        el.className = "screen screen-search";
        el.innerHTML = '<h2>Search</h2><form class="search-form" id="searchForm"><input type="text" id="searchInput" class="focusable" placeholder="Movies, TV shows\u2026" autocomplete="off" /><button type="submit" class="btn btn-play focusable">Search</button></form><div id="searchResults" class="search-results"></div>';
        container.appendChild(el);
        var form = el.querySelector("#searchForm");
        var input = el.querySelector("#searchInput");
        var results = el.querySelector("#searchResults");
        form.addEventListener("submit", function(e) {
          e.preventDefault();
          var q = (input.value || "").trim();
          if (!q) return;
          results.innerHTML = '<div class="loading-msg">Searching\u2026</div>';
          api.search(q).then(function(data) {
            var items = data.results || [];
            results.innerHTML = "";
            if (!items.length) {
              results.innerHTML = '<p class="loading-msg">No results for \u201C' + q + "\u201D.</p>";
              return;
            }
            for (var i = 0; i < items.length; i++) {
              results.appendChild(card.createCard(items[i], openItem));
            }
          }).catch(function(err) {
            results.innerHTML = '<div class="error-banner">Search failed: ' + (err.message || err) + "</div>";
          });
        });
      }
      module.exports = {
        render
      };
    }
  });

  // app/js/screens/settings.js
  var require_settings = __commonJS({
    "app/js/screens/settings.js"(exports, module) {
      var api = require_api();
      var config = require_config();
      function render(container) {
        var el = document.createElement("div");
        el.className = "screen screen-settings";
        el.innerHTML = '<h2>Settings</h2><div class="settings-field"><label for="apiBaseInput">API URL</label><input type="text" id="apiBaseInput" class="focusable" value="' + (api.getBase() || "") + '" /></div><button type="button" id="saveApiBtn" class="btn btn-play focusable">Save &amp; test</button><p id="settingsStatus" class="loading-msg"></p><p class="settings-hint">Quality: <strong>' + config.getQualityMode() + '</strong> (adaptive)</p><p class="settings-hint">Gate test: <a href="gate/index.html">gate/index.html</a></p><p class="settings-hint">Browser dev: use <code>http://localhost:8790</code> if the API runs on this PC.</p>';
        container.appendChild(el);
        var input = el.querySelector("#apiBaseInput");
        var saveBtn = el.querySelector("#saveApiBtn");
        var status = el.querySelector("#settingsStatus");
        saveBtn.addEventListener("click", function() {
          var url = (input.value || "").trim().replace(/\/$/, "");
          if (!url) {
            status.textContent = "Enter an API URL.";
            return;
          }
          api.setBase(url);
          status.textContent = "Testing\u2026";
          api.health().then(function(h) {
            status.textContent = "API OK \u2014 " + (h.service || "tizenflix-api");
            if (window.TizenflixApp) window.TizenflixApp.showStatus("API connected", false);
          }).catch(function(err) {
            status.textContent = "API unreachable: " + err.message;
          });
        });
      }
      module.exports = {
        render
      };
    }
  });

  // app/js/screens/mylist.js
  var require_mylist = __commonJS({
    "app/js/screens/mylist.js"(exports, module) {
      function render(container) {
        var el = document.createElement("div");
        el.className = "screen screen-mylist";
        el.innerHTML = '<div class="loading-msg" style="padding:48px"><h2>My List</h2><p>Your saved titles will appear here.</p></div>';
        container.appendChild(el);
      }
      module.exports = {
        render
      };
    }
  });

  // app/js/screens/detail-movie.js
  var require_detail_movie = __commonJS({
    "app/js/screens/detail-movie.js"(exports, module) {
      var api = require_api();
      var router = require_router();
      var playback = require_playback();
      var params = {};
      function escapeHtml(text) {
        if (!text) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      function onEnter(p) {
        params = p || {};
      }
      function render(container) {
        var el = document.createElement("div");
        el.className = "screen screen-detail screen-detail-movie";
        el.innerHTML = '<div class="loading-msg">Loading\u2026</div>';
        container.appendChild(el);
        if (!params.tmdbId) {
          el.innerHTML = '<div class="error-banner">Missing movie ID</div>';
          return;
        }
        api.getMovie(params.tmdbId).then(function(title) {
          var meta = [];
          if (title.year) meta.push(title.year);
          if (title.runtime) meta.push(title.runtime + " min");
          if (title.rating) meta.push("\u2605 " + title.rating.toFixed(1));
          el.innerHTML = `<div class="detail-hero"><div class="detail-backdrop" style="background-image:url('` + escapeHtml(title.backdrop || title.poster || "") + `')"></div><div class="detail-gradient"></div><div class="detail-content"><h1 class="detail-title">` + escapeHtml(title.title) + '</h1><p class="detail-meta">' + escapeHtml(meta.join(" \xB7 ")) + '</p><p class="detail-overview">' + escapeHtml(title.overview || "") + '</p><div class="detail-actions"><button type="button" class="btn btn-play focusable" id="detailPlayBtn">\u25B6 Play</button><button type="button" class="btn btn-info focusable" id="detailBackBtn">\u2190 Back</button></div></div></div>';
          var playBtn = el.querySelector("#detailPlayBtn");
          var backBtn = el.querySelector("#detailBackBtn");
          playBtn.addEventListener("click", function() {
            playback.playMovie(title.id, title.title, status).catch(function(err) {
              if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
            });
          });
          backBtn.addEventListener("click", function() {
            router.back();
          });
        }).catch(function(err) {
          el.innerHTML = '<div class="error-banner">Failed to load movie: ' + escapeHtml(err.message) + "</div>";
        });
        function status(msg) {
          if (window.TizenflixApp) window.TizenflixApp.showStatus(msg, false);
        }
      }
      module.exports = {
        onEnter,
        render
      };
    }
  });

  // app/js/screens/detail-tv.js
  var require_detail_tv = __commonJS({
    "app/js/screens/detail-tv.js"(exports, module) {
      var api = require_api();
      var router = require_router();
      var playback = require_playback();
      var params = {};
      var selectedSeason = 1;
      function escapeHtml(text) {
        if (!text) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      function onEnter(p) {
        params = p || {};
        selectedSeason = p && p.season || 1;
      }
      function renderEpisodes(el, tmdbId, showTitle) {
        var listEl = el.querySelector(".episode-list");
        if (!listEl) return;
        listEl.innerHTML = "<h3>Season " + selectedSeason + '</h3><div class="loading-msg">Loading episodes\u2026</div>';
        api.getEpisodes(tmdbId, selectedSeason).then(function(data) {
          var episodes = data.episodes || [];
          listEl.innerHTML = "<h3>Season " + selectedSeason + "</h3>";
          if (!episodes.length) {
            listEl.innerHTML += '<p class="loading-msg">No episodes found.</p>';
            return;
          }
          for (var i = 0; i < episodes.length; i++) {
            (function(ep) {
              var btn = document.createElement("button");
              btn.type = "button";
              btn.className = "episode-item focusable";
              btn.innerHTML = "<strong>E" + ep.episode + ": " + escapeHtml(ep.title) + "</strong><span>" + escapeHtml(ep.overview || "") + "</span>";
              btn.addEventListener("click", function() {
                var label = showTitle + " S" + ep.season + "E" + ep.episode;
                playback.playTvEpisode(tmdbId, ep.season, ep.episode, label, status).catch(function(err) {
                  if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
                });
              });
              listEl.appendChild(btn);
            })(episodes[i]);
          }
        }).catch(function(err) {
          listEl.innerHTML = "<h3>Season " + selectedSeason + '</h3><div class="error-banner">' + escapeHtml(err.message) + "</div>";
        });
        function status(msg) {
          if (window.TizenflixApp) window.TizenflixApp.showStatus(msg, false);
        }
      }
      function render(container) {
        var el = document.createElement("div");
        el.className = "screen screen-detail screen-detail-tv";
        el.innerHTML = '<div class="loading-msg">Loading\u2026</div>';
        container.appendChild(el);
        if (!params.tmdbId) {
          el.innerHTML = '<div class="error-banner">Missing series ID</div>';
          return;
        }
        api.getTv(params.tmdbId).then(function(title) {
          var meta = [];
          if (title.year) meta.push(title.year);
          if (title.rating) meta.push("\u2605 " + title.rating.toFixed(1));
          el.innerHTML = `<div class="detail-hero"><div class="detail-backdrop" style="background-image:url('` + escapeHtml(title.backdrop || title.poster || "") + `')"></div><div class="detail-gradient"></div><div class="detail-content"><h1 class="detail-title">` + escapeHtml(title.title) + '</h1><p class="detail-meta">' + escapeHtml(meta.join(" \xB7 ")) + '</p><p class="detail-overview">' + escapeHtml(title.overview || "") + '</p><div class="detail-actions"><button type="button" class="btn btn-play focusable" id="detailPlayS1E1">\u25B6 Play S1E1</button><button type="button" class="btn btn-info focusable" id="detailBackBtn">\u2190 Back</button></div></div></div><div class="episode-list"></div>';
          el.querySelector("#detailPlayS1E1").addEventListener("click", function() {
            playback.playTvEpisode(title.id, 1, 1, title.title + " S1E1", status).catch(function(err) {
              if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
            });
          });
          el.querySelector("#detailBackBtn").addEventListener("click", function() {
            router.back();
          });
          renderEpisodes(el, title.id, title.title);
        }).catch(function(err) {
          el.innerHTML = '<div class="error-banner">Failed to load series: ' + escapeHtml(err.message) + "</div>";
        });
        function status(msg) {
          if (window.TizenflixApp) window.TizenflixApp.showStatus(msg, false);
        }
      }
      module.exports = {
        onEnter,
        render
      };
    }
  });

  // app/js/app.js
  var require_app = __commonJS({
    "app/js/app.js"(exports, module) {
      var router = require_router();
      var focus = require_focus();
      var debug = require_debug();
      var player = require_player();
      var playback = require_playback();
      var home = require_home();
      var search = require_search();
      var settings = require_settings();
      var mylist = require_mylist();
      var detailMovie = require_detail_movie();
      var detailTv = require_detail_tv();
      function showStatus(message, isError) {
        var bar = document.getElementById("statusBar");
        if (!bar) return;
        bar.textContent = message;
        bar.classList.remove("hidden", "is-error");
        if (isError) bar.classList.add("is-error");
        clearTimeout(showStatus._timer);
        showStatus._timer = setTimeout(function() {
          bar.classList.add("hidden");
        }, 5e3);
      }
      function updateFocusHint(label) {
        var el = document.getElementById("focusHint");
        if (el) el.textContent = "Focused: " + label;
      }
      function browseScreen(mode) {
        return {
          onEnter: function() {
            home.setMode(mode);
          },
          render: home.render
        };
      }
      function setSidebarActive(screen) {
        var nav = document.getElementById("sidebar");
        if (!nav) return;
        var items = nav.querySelectorAll(".nav-item");
        for (var i = 0; i < items.length; i++) {
          items[i].classList.remove("active");
          if (items[i].getAttribute("data-screen") === screen) {
            items[i].classList.add("active");
          }
        }
      }
      function wireSidebar() {
        var nav = document.getElementById("sidebar");
        if (!nav) return;
        nav.addEventListener("click", function(e) {
          var btn = e.target;
          while (btn && btn !== nav && !btn.getAttribute("data-screen")) {
            btn = btn.parentNode;
          }
          if (!btn || btn === nav) return;
          var screen = btn.getAttribute("data-screen");
          if (!screen) return;
          router.replace(screen);
          setSidebarActive(screen);
        });
      }
      function wirePlayback() {
        var stopBtn = document.getElementById("btnStop");
        if (stopBtn) {
          stopBtn.addEventListener("click", function() {
            playback.stop();
          });
        }
      }
      function wireGlobalKeys() {
        document.addEventListener("keydown", function(e) {
          if (e.keyCode === 10009 || e.key === "Back") {
            if (document.body.classList.contains("is-playing")) {
              playback.stop();
              e.preventDefault();
              return;
            }
            if (router.back()) {
              e.preventDefault();
            }
          }
          if (player.isMediaPlayPauseKey(e)) {
            var video = document.getElementById("video");
            if (video) player.togglePlayPause(video);
          }
        });
      }
      function init() {
        if (!player.isTizenTv()) {
          document.body.classList.add("browser-dev");
        }
        debug.debugClear();
        debug.debugLog("Tizenflix \u2014 Tizen TV: " + (player.isTizenTv() ? "yes" : "no"));
        router.register("home", browseScreen("home"));
        router.register("trending", browseScreen("trending"));
        router.register("tv", browseScreen("tv"));
        router.register("movies", browseScreen("movies"));
        router.register("search", search);
        router.register("settings", settings);
        router.register("mylist", mylist);
        router.register("detail-movie", detailMovie);
        router.register("detail-tv", detailTv);
        router.init({
          root: document.getElementById("screen"),
          initial: "home",
          onFocusHint: updateFocusHint
        });
        setSidebarActive("home");
        wireSidebar();
        wirePlayback();
        wireGlobalKeys();
        focus.setupFocus(document.body, updateFocusHint);
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
      window.TizenflixApp = {
        router,
        showStatus
      };
      module.exports = {
        router,
        showStatus
      };
    }
  });
  return require_app();
})();
