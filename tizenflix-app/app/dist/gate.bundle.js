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
      var QUALITY_LEVEL_KEY = "tizenflix.qualityLevel";
      var DEV_MODE_KEY = "tizenflix.devMode";
      var BACKEND_KEY = "tizenflix.playBackend";
      var PREFERRED_SOURCE_KEY = "tizenflix.preferredSourceId";
      var PREFERRED_PROVIDER_KEY = "tizenflix.preferredProvider";
      var GRID_SCALE_KEY = "tizenflix.gridScale";
      var AUTOPLAY_KEY = "tizenflix.autoplay";
      var AUTOPLAY_BUFFER_KEY = "tizenflix.autoplayBuffer";
      var EXTRA_BUFFER_KEY = "tizenflix.extraBuffer";
      var PLAYBACK_SPEED_KEY = "tizenflix.playbackSpeed";
      var ANIMATIONS_KEY = "tizenflix.uiAnimations";
      var CATALOG_LANG_KEY = "tizenflix.catalogLang";
      var AUDIO_PREF_KEY = "tizenflix.audioPref";
      var TARGET_RESOLUTION_KEY = "tizenflix.targetResolution";
      var VALID_AUDIO_PREFS = ["original", "en", "de", "fr", "it", "es", "ja", "ko", "zh"];
      var VALID_TARGET_RESOLUTIONS = ["auto", "720", "1080", "2160"];
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
        var lang = getCatalogLang();
        if (lang && lang !== "en") parts.push("lang=" + encodeURIComponent(lang));
        var audioLang = getAudioPref();
        if (audioLang) parts.push("audioLang=" + encodeURIComponent(audioLang));
        var targetRes = getTargetResolution();
        if (targetRes !== "auto") {
          parts.push("maxHeight=" + encodeURIComponent(targetRes));
          var pq = preferredQualityForTarget(targetRes);
          if (pq) parts.push("preferredQuality=" + encodeURIComponent(pq));
        }
        if (extra) parts.push(extra);
        return parts.length ? parts.join("&") : null;
      }
      function preferredQualityForTarget(target) {
        if (target === "2160") return "4K";
        if (target === "1080") return "1080p";
        if (target === "720") return "720p";
        return null;
      }
      function parseHeightFromLabel(label) {
        if (!label) return 0;
        var text = String(label).toLowerCase();
        if (/4k|2160/.test(text)) return 2160;
        var match = text.match(/(\d+)\s*p/);
        if (match) return parseInt(match[1], 10);
        return 0;
      }
      function getTargetResolution() {
        try {
          var stored = localStorage.getItem(TARGET_RESOLUTION_KEY);
          if (stored && VALID_TARGET_RESOLUTIONS.indexOf(stored) !== -1) return stored;
          var legacy = localStorage.getItem(QUALITY_MODE_KEY);
          if (legacy === "high") return "1080";
          if (legacy === "medium") return "720";
          if (legacy === "low") return "720";
          if (legacy === "auto") return "auto";
        } catch (err) {
        }
        return "1080";
      }
      function setTargetResolution(value) {
        var v = VALID_TARGET_RESOLUTIONS.indexOf(value) !== -1 ? value : "1080";
        try {
          localStorage.setItem(TARGET_RESOLUTION_KEY, v);
          if (v === "auto") {
            localStorage.setItem(QUALITY_MODE_KEY, "auto");
          } else {
            localStorage.setItem(QUALITY_MODE_KEY, "high");
          }
        } catch (err) {
        }
        return v;
      }
      function targetResolutionPixels(target) {
        var t = target || getTargetResolution();
        if (t === "auto") return 0;
        return parseInt(t, 10) || 0;
      }
      function orderSourcesForTargetResolution(sources, target) {
        if (!sources || !sources.length) return sources || [];
        var targetPx = targetResolutionPixels(target);
        if (!targetPx) return sources.slice();
        return sources.slice().sort(function(a, b) {
          var ha = parseHeightFromLabel(a.label);
          var hb = parseHeightFromLabel(b.label);
          function score(h) {
            if (!h) return -1;
            if (h === targetPx) return 1e4 + h;
            if (h < targetPx) return 5e3 + h;
            return h;
          }
          var sa = score(ha);
          var sb = score(hb);
          if (sa !== sb) return sb - sa;
          if (a.priority !== b.priority) return a.priority - b.priority;
          return hb - ha;
        });
      }
      function maxSourceHeight(play) {
        var sources = play && play.sources ? play.sources : [];
        var max = 0;
        for (var i = 0; i < sources.length; i++) {
          var h = parseHeightFromLabel(sources[i].label);
          if (h > max) max = h;
        }
        return max;
      }
      function qualityHeightScore(height, target) {
        var targetPx = targetResolutionPixels(target);
        if (!targetPx) return height || 0;
        if (!height) return -1;
        if (height === targetPx) return 1e4 + height;
        if (height < targetPx) return 5e3 + height;
        return height;
      }
      function isBelowTargetResolution(play, target) {
        var targetPx = targetResolutionPixels(target);
        if (!targetPx || !play) return false;
        return maxSourceHeight(play) < targetPx;
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
        var m = mode === "streamflix" || mode === "auto" || mode === "tmdb-native" || mode === "vidking" ? mode : "auto";
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
      function getPreferredProviderId() {
        try {
          var stored = localStorage.getItem(PREFERRED_PROVIDER_KEY);
          if (stored && typeof stored === "string") return stored;
        } catch (err) {
        }
        return null;
      }
      function setPreferredProviderId(providerId) {
        try {
          if (!providerId) localStorage.removeItem(PREFERRED_PROVIDER_KEY);
          else localStorage.setItem(PREFERRED_PROVIDER_KEY, String(providerId));
        } catch (err) {
        }
        return providerId || null;
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
      function fetchWithTimeout(url, ms, init2) {
        return new Promise(function(resolve, reject) {
          var done = false;
          var timer = setTimeout(function() {
            if (done) return;
            done = true;
            reject(new Error("Request timed out after " + ms + "ms"));
          }, ms);
          fetch(url, init2).then(function(res) {
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
        return "high";
      }
      function setQualityMode(mode) {
        var m = VALID_QUALITY_MODES.indexOf(mode) !== -1 ? mode : "auto";
        try {
          localStorage.setItem(QUALITY_MODE_KEY, m);
        } catch (err) {
        }
        return m;
      }
      function readStoredQualityLevel() {
        try {
          var stored = localStorage.getItem(QUALITY_LEVEL_KEY);
          if (stored === "auto") return { mode: "auto", level: -1 };
          if (stored !== null && stored !== "") {
            var n = parseInt(stored, 10);
            if (isFinite(n) && n >= 0) return { mode: "manual", level: n };
          }
        } catch (err) {
        }
        return null;
      }
      function writeQualityLevelPref(pref) {
        try {
          if (!pref || pref.mode === "auto") {
            localStorage.setItem(QUALITY_LEVEL_KEY, "auto");
            return;
          }
          localStorage.setItem(QUALITY_LEVEL_KEY, String(pref.level));
        } catch (err) {
        }
      }
      function levelHeightsFromHls(hls) {
        var out = [];
        if (!hls || !hls.levels) return out;
        for (var i = 0; i < hls.levels.length; i++) {
          out.push({
            index: i,
            height: hls.levels[i].height || 0,
            bitrate: hls.levels[i].bitrate || 0
          });
        }
        return out;
      }
      function levelIndexForTargetHeight(hls, targetPixels) {
        var indexed = levelHeightsFromHls(hls);
        if (!indexed.length) return -1;
        indexed.sort(function(a, b) {
          return a.height - b.height;
        });
        if (!targetPixels) {
          return indexed[0].index;
        }
        var best = null;
        for (var i = 0; i < indexed.length; i++) {
          var item = indexed[i];
          if (item.height > 0 && item.height <= targetPixels) best = item;
        }
        if (best) return best.index;
        return indexed[indexed.length - 1].index;
      }
      function levelIndexForLegacyMode(hls, mode) {
        if (mode === "high") return levelIndexForTargetHeight(hls, 1080);
        if (mode === "medium") return levelIndexForTargetHeight(hls, 720);
        if (mode === "low") return levelIndexForTargetHeight(hls, 480);
        return -1;
      }
      function legacyModeToLevel(mode, levelCount) {
        if (!levelCount || levelCount < 1) return -1;
        if (mode === "high") return levelCount - 1;
        if (mode === "medium") return levelCount > 1 ? Math.floor(levelCount / 2) : 0;
        if (mode === "low") return 0;
        return -1;
      }
      function getQualityPreference() {
        var stored = readStoredQualityLevel();
        if (stored) return stored;
        var legacy = getQualityMode();
        if (legacy === "auto") return { mode: "auto", level: -1 };
        return { mode: "manual", level: -1, legacyMode: legacy };
      }
      function setQualityAuto() {
        writeQualityLevelPref({ mode: "auto", level: -1 });
        try {
          localStorage.removeItem(QUALITY_MODE_KEY);
        } catch (err) {
        }
        return { mode: "auto", level: -1 };
      }
      function setQualityLevel(index) {
        var level = typeof index === "number" && isFinite(index) && index >= 0 ? Math.floor(index) : 0;
        writeQualityLevelPref({ mode: "manual", level });
        try {
          localStorage.removeItem(QUALITY_MODE_KEY);
        } catch (err) {
        }
        return { mode: "manual", level };
      }
      function resolveLegacyQualityLevel(hls) {
        var pref = getQualityPreference();
        if (pref.mode === "auto" || pref.level >= 0) return pref;
        if (!pref.legacyMode || !hls || !hls.levels || !hls.levels.length) {
          return { mode: "auto", level: -1 };
        }
        var level = levelIndexForLegacyMode(hls, pref.legacyMode);
        if (level < 0) level = legacyModeToLevel(pref.legacyMode, hls.levels.length);
        if (level < 0) return setQualityAuto();
        return setQualityLevel(level);
      }
      function readNumber(key, fallback, min, max) {
        try {
          var stored = localStorage.getItem(key);
          if (stored === null || stored === "") return fallback;
          var n = parseInt(stored, 10);
          if (!isFinite(n)) return fallback;
          if (n < min) return min;
          if (n > max) return max;
          return n;
        } catch (err) {
          return fallback;
        }
      }
      function writeNumber(key, value) {
        try {
          localStorage.setItem(key, String(value));
        } catch (err) {
        }
      }
      function getGridScale() {
        return readNumber(GRID_SCALE_KEY, 100, 70, 130);
      }
      function setGridScale(value) {
        var v = readNumber(GRID_SCALE_KEY, value, 70, 130);
        writeNumber(GRID_SCALE_KEY, v);
        applyGridScale(v);
        return v;
      }
      function applyGridScale(scale) {
        if (typeof document === "undefined" || !document.body) return;
        var pct = scale || getGridScale();
        document.body.style.fontSize = Math.round(28 * (pct / 100)) + "px";
        document.body.setAttribute("data-grid-scale", String(pct));
      }
      function getAutoplayNext() {
        try {
          var stored = localStorage.getItem(AUTOPLAY_KEY);
          if (stored === "0" || stored === "false") return false;
        } catch (err) {
        }
        return true;
      }
      function setAutoplayNext(enabled) {
        try {
          localStorage.setItem(AUTOPLAY_KEY, enabled ? "1" : "0");
        } catch (err) {
        }
        return !!enabled;
      }
      function getAutoplayBufferSec() {
        return readNumber(AUTOPLAY_BUFFER_KEY, 3, 0, 30);
      }
      function setAutoplayBufferSec(sec) {
        var v = readNumber(AUTOPLAY_BUFFER_KEY, sec, 0, 30);
        writeNumber(AUTOPLAY_BUFFER_KEY, v);
        return v;
      }
      function getExtraBuffering() {
        try {
          var stored = localStorage.getItem(EXTRA_BUFFER_KEY);
          if (stored === "1") return true;
          if (stored === "0") return false;
        } catch (err) {
        }
        return isTizenClient();
      }
      function setExtraBuffering(enabled) {
        try {
          localStorage.setItem(EXTRA_BUFFER_KEY, enabled ? "1" : "0");
        } catch (err) {
        }
        return !!enabled;
      }
      function getPlaybackSpeed() {
        var speeds = [0.75, 1, 1.25, 1.5, 2];
        var stored = "1";
        try {
          stored = localStorage.getItem(PLAYBACK_SPEED_KEY) || "1";
        } catch (err) {
        }
        var n = parseFloat(stored);
        for (var i = 0; i < speeds.length; i++) {
          if (speeds[i] === n) return n;
        }
        return 1;
      }
      function setPlaybackSpeed(speed) {
        var n = parseFloat(speed);
        if (!isFinite(n) || n <= 0) n = 1;
        try {
          localStorage.setItem(PLAYBACK_SPEED_KEY, String(n));
        } catch (err) {
        }
        return n;
      }
      function cyclePlaybackSpeed() {
        var speeds = [0.75, 1, 1.25, 1.5, 2];
        var current = getPlaybackSpeed();
        var idx = speeds.indexOf(current);
        var next = speeds[(idx + 1) % speeds.length];
        return setPlaybackSpeed(next);
      }
      function getCatalogLang() {
        try {
          var stored = localStorage.getItem(CATALOG_LANG_KEY);
          if (stored && typeof stored === "string") return stored;
        } catch (err) {
        }
        return "en";
      }
      function setCatalogLang(lang) {
        var code = (lang || "en").toLowerCase().split("-")[0];
        try {
          localStorage.setItem(CATALOG_LANG_KEY, code);
        } catch (err) {
        }
        return code;
      }
      function getAudioPref() {
        try {
          var stored = localStorage.getItem(AUDIO_PREF_KEY);
          if (stored && VALID_AUDIO_PREFS.indexOf(stored) !== -1) return stored;
        } catch (err) {
        }
        return "original";
      }
      function setAudioPref(pref) {
        var value = VALID_AUDIO_PREFS.indexOf(pref) !== -1 ? pref : "original";
        try {
          localStorage.setItem(AUDIO_PREF_KEY, value);
        } catch (err) {
        }
        return value;
      }
      function getUiAnimations() {
        try {
          var stored = localStorage.getItem(ANIMATIONS_KEY);
          if (stored === "0" || stored === "false") return false;
          if (stored === "1" || stored === "true") return true;
        } catch (err) {
        }
        return true;
      }
      function setUiAnimations(enabled) {
        try {
          localStorage.setItem(ANIMATIONS_KEY, enabled ? "1" : "0");
        } catch (err) {
        }
        return !!enabled;
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
        var target = getTargetResolution();
        sources = orderSourcesForTargetResolution(sources, target);
        if (!play || !play.recommended) return sources;
        var targetPx = targetResolutionPixels(target);
        var first = null;
        var rest = [];
        for (var i = 0; i < sources.length; i++) {
          if (sources[i].id === play.recommended) first = sources[i];
          else rest.push(sources[i]);
        }
        if (!first) return sources;
        if (target === "auto") return [first].concat(rest);
        var recH = parseHeightFromLabel(first.label);
        if (!targetPx || recH >= targetPx || recH === 0) return [first].concat(rest);
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
      function apiPost(path, body) {
        return fetchWithTimeout(
          getApiBase() + path,
          2e4,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body || {})
          }
        ).then(function(res) {
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
        QUALITY_LEVEL_KEY,
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
        getPreferredProviderId,
        setPreferredProviderId,
        getApiBase,
        setApiBase,
        getQualityMode,
        setQualityMode,
        getQualityPreference,
        setQualityAuto,
        setQualityLevel,
        resolveLegacyQualityLevel,
        levelIndexForLegacyMode,
        levelIndexForTargetHeight,
        getTargetResolution,
        setTargetResolution,
        targetResolutionPixels,
        preferredQualityForTarget,
        parseHeightFromLabel,
        orderSourcesForTargetResolution,
        maxSourceHeight,
        qualityHeightScore,
        isBelowTargetResolution,
        VALID_TARGET_RESOLUTIONS,
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
        apiPost,
        fetchWithTimeout,
        GRID_SCALE_KEY,
        getGridScale,
        setGridScale,
        applyGridScale,
        getAutoplayNext,
        setAutoplayNext,
        getAutoplayBufferSec,
        setAutoplayBufferSec,
        getExtraBuffering,
        setExtraBuffering,
        getPlaybackSpeed,
        setPlaybackSpeed,
        cyclePlaybackSpeed,
        getCatalogLang,
        setCatalogLang,
        CATALOG_LANG_KEY,
        AUDIO_PREF_KEY,
        VALID_AUDIO_PREFS,
        getAudioPref,
        setAudioPref,
        getUiAnimations,
        setUiAnimations
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
      var resumeAtSeconds = null;
      var currentProvider = null;
      var playbackReported = false;
      var nonFatalRecoveries = 0;
      var activeSubtitles = [];
      var activeSubtitleIndex = -1;
      var qualityChangeListeners = [];
      var nativeQualityVideo = null;
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
      var READY_TIMEOUT_MS = 5e3;
      var HLS_PRIME_BUFFER_SEC = 4;
      var HLS_PRIME_TIMEOUT_MS = 3e3;
      var HLS_EARLY_START_BUFFER_SEC = 2;
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
        nativeQualityVideo = null;
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
      function applyResumePosition(video) {
        if (!video || resumeAtSeconds == null || resumeAtSeconds <= 0) return;
        var duration = video.duration;
        if (!duration || !isFinite(duration)) return;
        var target = Math.min(resumeAtSeconds, Math.max(0, duration - 10));
        try {
          video.currentTime = target;
          debug2.debugLog("Resumed at " + Math.floor(target) + "s");
        } catch (err) {
          debug2.debugLog("Resume seek failed: " + err.message);
        }
        resumeAtSeconds = null;
      }
      function setResumePosition(seconds) {
        resumeAtSeconds = seconds > 0 ? seconds : null;
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
            applyResumePosition(video);
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
        if (isProxiedHls(url)) return true;
        if (prefersNativeHls()) {
          var pref = config2.getQualityPreference();
          if (pref.mode === "manual") return true;
          return false;
        }
        return false;
      }
      function createHlsInstance() {
        var extra = config2.getExtraBuffering();
        var baseMax = extra ? 120 : isTizenTv() ? 90 : 60;
        return new Hls({
          enableWorker: false,
          maxBufferLength: baseMax,
          maxMaxBufferLength: extra ? 300 : isTizenTv() ? 240 : 180,
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
          backBufferLength: 45,
          maxStarvationDelay: 4,
          maxLoadingDelay: 4
        });
      }
      function formatQualityLabel(level) {
        if (!level) return "\u2014";
        if (level.height) return level.height + "p";
        if (level.width && level.height) return level.width + "x" + level.height;
        return "Level";
      }
      function formatQualityLabelFromHeight(height) {
        if (!height || !isFinite(height)) return "\u2014";
        return Math.round(height) + "p";
      }
      function notifyQualityChange(info) {
        for (var i = 0; i < qualityChangeListeners.length; i++) {
          try {
            qualityChangeListeners[i](info);
          } catch (e) {
          }
        }
      }
      function onQualityChange(callback) {
        if (typeof callback !== "function") return function() {
        };
        qualityChangeListeners.push(callback);
        return function() {
          var idx = qualityChangeListeners.indexOf(callback);
          if (idx !== -1) qualityChangeListeners.splice(idx, 1);
        };
      }
      function getQualityOptions(hls) {
        if (!hls || !hls.levels || !hls.levels.length) return [];
        var out = [];
        for (var i = 0; i < hls.levels.length; i++) {
          var level = hls.levels[i];
          var label = formatQualityLabel(level);
          if (label === "Level") label = "Level " + (i + 1);
          out.push({ level: i, label, bitrate: level.bitrate || 0, height: level.height || 0 });
        }
        return out;
      }
      function getCurrentQuality(hls, video) {
        if (hls && hls.levels && hls.levels.length) {
          var pref = config2.getQualityPreference();
          var targetAuto = config2.getTargetResolution() === "auto";
          var isAuto = (pref.mode === "auto" || hls.currentLevel === -1) && targetAuto;
          var activeIndex = isAuto ? hls.loadLevel : hls.currentLevel;
          if (activeIndex == null || activeIndex < 0) activeIndex = hls.loadLevel;
          if (activeIndex == null || activeIndex < 0) activeIndex = 0;
          var activeLevel = hls.levels[activeIndex];
          var height = activeLevel && activeLevel.height ? activeLevel.height : 0;
          var label = height ? formatQualityLabelFromHeight(height) : "\u2014";
          if (!height && activeLevel) {
            label = formatQualityLabel(activeLevel);
            if (label === "Level") label = "\u2014";
          }
          return {
            label,
            height,
            isAuto,
            badge: isAuto && label !== "\u2014" ? "Auto \xB7 " + label : label
          };
        }
        if (video && video.videoHeight) {
          var nativeLabel = formatQualityLabelFromHeight(video.videoHeight);
          return { label: nativeLabel, height: video.videoHeight, isAuto: true, badge: nativeLabel };
        }
        return { label: "\u2014", height: 0, isAuto: true, badge: "\u2014" };
      }
      function logTargetQualityWarning(hls, onLog, sourceLabel) {
        var target = config2.getTargetResolution();
        if (target === "auto" || !hls || !hls.levels || !hls.levels.length) return;
        var targetPx = config2.targetResolutionPixels(target);
        if (!targetPx) return;
        var info = getCurrentQuality(hls, hls.media);
        if (!info.height || info.height >= targetPx) return;
        var want = config2.preferredQualityForTarget(target) || target + "p";
        var maxLevel = 0;
        for (var i = 0; i < hls.levels.length; i++) {
          var lh = hls.levels[i].height || 0;
          if (lh > maxLevel) maxLevel = lh;
        }
        var msg = "Playing " + info.label + " (" + want + " requested)";
        if (maxLevel > 0) {
          msg += " \u2014 manifest max " + maxLevel + "p";
        }
        if (sourceLabel) {
          msg += " [" + sourceLabel + "]";
        }
        debug2.debugLog(msg);
        if (onLog) onLog(msg);
      }
      function applyQualityPreference(hls, onLog) {
        if (!hls) return;
        var pref = config2.getQualityPreference();
        if (pref.mode === "manual" && pref.level >= 0) {
          hls.currentLevel = pref.level;
          logTargetQualityWarning(hls, onLog);
          return;
        }
        var target = config2.getTargetResolution();
        if (target === "auto") {
          hls.currentLevel = -1;
          if (typeof hls.minAutoBitrate === "number") hls.minAutoBitrate = 0;
          var lowIdx = config2.levelIndexForTargetHeight(hls, 0);
          if (lowIdx >= 0) hls.startLevel = lowIdx;
          return;
        }
        var targetPx = config2.targetResolutionPixels(target);
        var level = config2.levelIndexForTargetHeight(hls, targetPx);
        if (level < 0) return;
        hls.currentLevel = level;
        var locked = hls.levels[level];
        if (locked && locked.bitrate) {
          hls.minAutoBitrate = locked.bitrate;
        }
        logTargetQualityWarning(hls, onLog);
      }
      function applyQualityMode(hls, mode) {
        if (!hls) return;
        if (mode === "auto") {
          applyQualityPreference(hls);
          return;
        }
        var level = config2.levelIndexForLegacyMode(hls, mode);
        if (level < 0) return;
        hls.currentLevel = level;
      }
      function setQualityLevel(hls, level) {
        if (!hls) return false;
        if (level < 0) {
          config2.setQualityAuto();
          hls.currentLevel = -1;
          if (typeof hls.minAutoBitrate === "number") hls.minAutoBitrate = 0;
          var lowIdx = config2.levelIndexForTargetHeight(hls, 0);
          if (lowIdx >= 0) hls.startLevel = lowIdx;
          notifyQualityChange(getCurrentQuality(hls, hls.media));
          return true;
        }
        var levels = hls.levels ? hls.levels.length : 0;
        if (!levels || level >= levels) return false;
        config2.setQualityLevel(level);
        hls.currentLevel = level;
        notifyQualityChange(getCurrentQuality(hls, hls.media));
        return true;
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
          } else if (ahead >= HLS_EARLY_START_BUFFER_SEC && label === "frag") {
            started = true;
            debug2.debugLog("HLS early start " + Math.floor(ahead) + "s after first fragment");
            if (onLog) onLog("Starting with " + Math.floor(ahead) + "s buffered");
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
      function setupBufferWatchdog(video, hls, session, onLog) {
        var lowSince = 0;
        function checkBuffer() {
          if (!isActiveSession(session) || !hls || video.paused) return;
          var ahead = bufferedAheadSec(video);
          if (ahead >= 8) {
            lowSince = 0;
            return;
          }
          if (ahead < 3) {
            var now = Date.now();
            if (!lowSince) lowSince = now;
            else if (now - lowSince > 3e3) {
              lowSince = 0;
              recoverNonFatalHlsError(hls, video, { details: "bufferStalledError" }, onLog);
            }
          } else {
            lowSince = 0;
          }
        }
        video.addEventListener("timeupdate", checkBuffer);
        trackCleanup(function() {
          video.removeEventListener("timeupdate", checkBuffer);
        });
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
            applyQualityPreference(hls, onLog);
            safePlay(video);
          } catch (e) {
          }
          return true;
        }
        if (details === "fragLoadTimeOut" || details === "fragLoadError") {
          try {
            hls.startLoad(-1);
            applyQualityPreference(hls, onLog);
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
        setupBufferWatchdog(video, hlsInstance, session, onLog);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
          if (!isActiveSession(session)) return;
          var levelCount = hlsInstance.levels ? hlsInstance.levels.length : 0;
          var maxH = 0;
          if (hlsInstance.levels) {
            for (var li = 0; li < hlsInstance.levels.length; li++) {
              var lh = hlsInstance.levels[li].height || 0;
              if (lh > maxH) maxH = lh;
            }
          }
          debug2.debugLog(
            "HLS.js manifest parsed \u2014 levels: " + levelCount + ", max height: " + (maxH ? maxH + "p" : "unknown")
          );
          if (onLog) {
            onLog(
              "HLS.js manifest parsed \u2014 " + levelCount + " level(s)" + (maxH ? ", max " + maxH + "p" : "")
            );
          }
          applyQualityPreference(hlsInstance, onLog);
          notifyQualityChange(getCurrentQuality(hlsInstance, video));
          setupPlaybackHealthReport(video, session);
          startHlsPlaybackWhenBuffered(video, videoWrap, title, onLog, session, hlsInstance);
        });
        hlsInstance.on(Hls.Events.LEVEL_SWITCHED, function() {
          if (!isActiveSession(session)) return;
          notifyQualityChange(getCurrentQuality(hlsInstance, video));
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
          notifyQualityChange(getCurrentQuality(hlsInstance, video));
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
      function setupNativeQualityTracking(video, session) {
        if (!video) return;
        nativeQualityVideo = video;
        function reportNativeQuality() {
          if (!isActiveSession(session) || hlsInstance) return;
          notifyQualityChange(getCurrentQuality(null, video));
        }
        video.addEventListener("loadedmetadata", reportNativeQuality);
        video.addEventListener("resize", reportNativeQuality);
        trackCleanup(function() {
          video.removeEventListener("loadedmetadata", reportNativeQuality);
          video.removeEventListener("resize", reportNativeQuality);
          if (nativeQualityVideo === video) nativeQualityVideo = null;
        });
      }
      function playNativeHls(video, url, onLog, videoWrap, title, session, onStallFallback, onFatal) {
        debug2.debugLog("Player path: native HLS");
        if (onLog) onLog("Player path: native HLS (wait up to 5s, then HLS.js fallback)");
        setCrossOrigin(video, true);
        video.src = url;
        setupNativeQualityTracking(video, session);
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
      function playSources(video, sources, onLog, videoWrap, title, options) {
        options = options || {};
        if (options.startSeconds > 0) {
          setResumePosition(options.startSeconds);
        }
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
        if (options.warmedManifestUrl && sources[0] && sources[0].url === options.warmedManifestUrl) {
          debug2.debugLog("Using warmed manifest");
          if (onLog) onLog("Using warmed manifest");
        }
        var lastFailureReason = null;
        function tryNext(reason) {
          if (reason) {
            lastFailureReason = reason;
            debug2.debugLog(reason);
            if (onLog) onLog(reason);
          }
          if (index >= sources.length) {
            var done = "All sources failed \u2014 CDN may be blocking playback";
            debug2.debugLog(done);
            if (onLog) onLog(done);
            if (options.onAllSourcesFailed) {
              options.onAllSourcesFailed(lastFailureReason || done);
            }
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
          if (onLog) onLog(label);
          else debug2.debugLog(label);
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
        applyQualityPreference,
        setQualityLevel,
        getCurrentQuality,
        onQualityChange,
        formatQualityLabel,
        setResumePosition,
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
      var EASE_CURVE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
      var BROWSER = {
        transformMs: 300,
        opacityMs: 400,
        scrollMs: 300,
        mainScrollMs: 300,
        heroDebounceMs: 400,
        fadeMs: 400,
        heroBackdropMs: 400,
        heroTrailerDelayMs: 1500,
        screenEnterMs: 280,
        screenExitMs: 220,
        zonePulseMs: 50,
        handoffMs: 280,
        kenBurnsMs: 6e3,
        cardFocusScale: 1.12
      };
      var TV = {
        transformMs: 200,
        opacityMs: 250,
        scrollMs: 200,
        mainScrollMs: 180,
        heroDebounceMs: 300,
        fadeMs: 300,
        heroBackdropMs: 300,
        heroTrailerDelayMs: 1200,
        screenEnterMs: 150,
        screenExitMs: 120,
        zonePulseMs: 50,
        handoffMs: 150,
        kenBurnsMs: 0,
        cardFocusScale: 1.1
      };
      var ROW_ANCHOR_SPOTLIGHT_PX = 48;
      var ROW_ANCHOR_FALLBACK_PX = 140;
      var BROWSE_LANE_MIN_PX = 120;
      var BROWSE_LANE_RATIO = 0.38;
      var BROWSE_LANE_MAX_RATIO = 0.48;
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
      function animationsEnabled() {
        if (prefersReducedMotion()) return false;
        return config2.getUiAnimations();
      }
      function shouldSnapScroll(distance) {
        if (!animationsEnabled()) return true;
        if (isTvPerfMode() && Math.abs(distance) > 400) return true;
        return false;
      }
      function useCssRowScroll() {
        return animationsEnabled();
      }
      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
      }
      function applyBodyClass() {
        if (typeof document === "undefined" || !document.body) return;
        document.body.classList.toggle("tv-perf", isTvPerfMode());
        document.body.classList.toggle("animations-off", !animationsEnabled());
      }
      function computeBrowseLaneAnchorY(main) {
        var height = 0;
        if (main && main.clientHeight > 0) {
          height = main.clientHeight;
        } else if (typeof window !== "undefined" && window.innerHeight) {
          height = window.innerHeight;
        }
        if (height < 1) height = 720;
        var scaled = Math.round(height * BROWSE_LANE_RATIO);
        var maxAnchor = Math.round(height * BROWSE_LANE_MAX_RATIO);
        if (scaled < BROWSE_LANE_MIN_PX) scaled = BROWSE_LANE_MIN_PX;
        if (scaled > maxAnchor) scaled = maxAnchor;
        return scaled;
      }
      module.exports = {
        EASE_CURVE,
        BROWSER,
        TV,
        ROW_ANCHOR_SPOTLIGHT_PX,
        ROW_ANCHOR_FALLBACK_PX,
        BROWSE_LANE_MIN_PX,
        isTvPerfMode,
        setTvPerfMode,
        getMotionProfile,
        prefersReducedMotion,
        animationsEnabled,
        shouldSnapScroll,
        useCssRowScroll,
        easeOutCubic,
        applyBodyClass,
        computeBrowseLaneAnchorY
      };
    }
  });

  // app/js/services/api.js
  var require_api = __commonJS({
    "app/js/services/api.js"(exports, module) {
      var config2 = require_config();
      function getBase() {
        return config2.getApiBase();
      }
      function health() {
        return config2.checkHealth(getBase());
      }
      function browseRows() {
        return config2.apiGet("/browse/rows");
      }
      function browseRow(rowId, page) {
        var q = page ? "?page=" + encodeURIComponent(page) : "";
        return config2.apiGet("/browse/row/" + encodeURIComponent(rowId) + q);
      }
      function search(query, page) {
        var q = "?q=" + encodeURIComponent(query);
        if (page) q += "&page=" + encodeURIComponent(page);
        return config2.apiGet("/search" + q);
      }
      function searchSuggest(query) {
        return config2.apiGet("/search/suggest?q=" + encodeURIComponent(query));
      }
      function getMovie(tmdbId) {
        return config2.apiGet("/title/movie/" + encodeURIComponent(tmdbId));
      }
      function getTv(tmdbId) {
        return config2.apiGet("/title/tv/" + encodeURIComponent(tmdbId));
      }
      function getSeasons(tmdbId) {
        return config2.apiGet("/title/tv/" + encodeURIComponent(tmdbId) + "/seasons");
      }
      function getEpisodes(tmdbId, season) {
        return config2.apiGet(
          "/title/tv/" + encodeURIComponent(tmdbId) + "/" + encodeURIComponent(season) + "/episodes"
        );
      }
      function resolveMovie(tmdbId, extraQuery, timeoutMs) {
        return config2.resolveMovie(getBase(), tmdbId, config2.buildPlayQuery(extraQuery), timeoutMs);
      }
      function resolveTvEpisode(tmdbId, season, episode, extraQuery, timeoutMs) {
        return config2.resolveTvEpisode(
          getBase(),
          tmdbId,
          season,
          episode,
          config2.buildPlayQuery(extraQuery),
          timeoutMs
        );
      }
      function sourcesForPlay(play) {
        return config2.listSourcesToTry(play);
      }
      function hasPlayableSources(play) {
        return sourcesForPlay(play).length > 0;
      }
      function getProviders() {
        return config2.apiGet("/providers/tmdb-native");
      }
      function continueWatching(limit) {
        var q = limit ? "?limit=" + encodeURIComponent(limit) : "";
        return config2.apiGet("/continue-watching" + q).then(function(data) {
          return data.items || [];
        });
      }
      function saveProgress(payload) {
        return config2.apiPost("/progress", payload);
      }
      function warmStreamUrl(url) {
        return config2.fetchWithTimeout(url, 8e3).then(function(res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        });
      }
      function fetchPlaySubtitlesMovie(tmdbId) {
        return config2.apiGet("/play/subtitles/movie/" + encodeURIComponent(tmdbId));
      }
      function fetchPlaySubtitlesTv(tmdbId, season, episode) {
        return config2.apiGet(
          "/play/subtitles/tv/" + encodeURIComponent(tmdbId) + "/" + encodeURIComponent(season) + "/" + encodeURIComponent(episode)
        );
      }
      function listGenres(type) {
        return config2.apiGet("/browse/genres?type=" + encodeURIComponent(type || "movie"));
      }
      function browseGenre(genreId, type, page) {
        var q = "?type=" + encodeURIComponent(type || "movie");
        if (page) q += "&page=" + encodeURIComponent(page);
        return config2.apiGet("/browse/genre/" + encodeURIComponent(genreId) + q);
      }
      function getStreamflixProviders() {
        return config2.apiGet("/providers/streamflix");
      }
      function toggleStreamflixProvider(id, enabled) {
        return config2.apiPost("/providers/streamflix/toggle", { id, enabled });
      }
      function getLiveProviders() {
        return config2.apiGet("/live/providers");
      }
      function getLiveChannels(providerId) {
        return config2.apiGet("/live/" + encodeURIComponent(providerId) + "/channels");
      }
      function resolveLiveChannel(providerId, channelId) {
        return config2.apiGet(
          "/live/" + encodeURIComponent(providerId) + "/play/" + encodeURIComponent(channelId)
        );
      }
      module.exports = {
        getBase,
        setBase: config2.setApiBase,
        health,
        browseRows,
        browseRow,
        search,
        searchSuggest,
        getMovie,
        getTv,
        getSeasons,
        getEpisodes,
        resolveMovie,
        resolveTvEpisode,
        sourcesForPlay,
        hasPlayableSources,
        getProviders,
        continueWatching,
        saveProgress,
        warmStreamUrl,
        fetchPlaySubtitlesMovie,
        fetchPlaySubtitlesTv,
        listGenres,
        browseGenre,
        getStreamflixProviders,
        toggleStreamflixProvider,
        getLiveProviders,
        getLiveChannels,
        resolveLiveChannel
      };
    }
  });

  // app/js/services/playback-session.js
  var require_playback_session = __commonJS({
    "app/js/services/playback-session.js"(exports, module) {
      var current = null;
      var prefetchCache = null;
      var warmedManifestUrl = null;
      var PREFETCH_TTL_MS = 5 * 60 * 1e3;
      function prefetchKey(type, tmdbId, season, episode) {
        return type + ":" + tmdbId + ":" + (season || "") + ":" + (episode || "");
      }
      function setPrefetch(key, play) {
        prefetchCache = { key, play, fetchedAt: Date.now() };
      }
      function getPrefetch(key) {
        if (!prefetchCache || prefetchCache.key !== key) return null;
        if (Date.now() - prefetchCache.fetchedAt > PREFETCH_TTL_MS) {
          prefetchCache = null;
          return null;
        }
        return prefetchCache.play;
      }
      function clearPrefetch() {
        prefetchCache = null;
        warmedManifestUrl = null;
      }
      function setWarmedManifest(url) {
        warmedManifestUrl = url || null;
      }
      function getWarmedManifest() {
        return warmedManifestUrl;
      }
      function create(meta) {
        meta = meta || {};
        current = {
          tmdbId: meta.tmdbId || null,
          type: meta.type || "movie",
          season: meta.season || null,
          episode: meta.episode || null,
          title: meta.title || "",
          showTitle: meta.showTitle || meta.title || "",
          episodeTitle: meta.episodeTitle || "",
          overview: meta.overview || "",
          metaLine: meta.metaLine || "",
          play: null,
          sources: [],
          currentSourceIndex: 0,
          subtitles: [],
          activeSubtitleIndex: -1,
          nextEpisode: null,
          displayTitle: meta.displayTitle || meta.title || ""
        };
        return current;
      }
      function get() {
        return current;
      }
      function update(patch) {
        if (!current || !patch) return current;
        for (var key in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, key)) {
            current[key] = patch[key];
          }
        }
        return current;
      }
      function setFromPlay(play, sources, extras) {
        if (!current) return null;
        extras = extras || {};
        current.play = play;
        current.sources = sources || [];
        current.currentSourceIndex = 0;
        current.subtitles = play && play.subtitles || [];
        current.activeSubtitleIndex = -1;
        current.nextEpisode = play && play.nextEpisode ? play.nextEpisode : null;
        if (play && play.title && !current.showTitle) current.showTitle = play.title;
        if (extras.displayTitle) current.displayTitle = extras.displayTitle;
        return current;
      }
      function clear() {
        current = null;
      }
      module.exports = {
        create,
        get,
        update,
        setFromPlay,
        clear,
        prefetchKey,
        setPrefetch,
        getPrefetch,
        clearPrefetch,
        setWarmedManifest,
        getWarmedManifest
      };
    }
  });

  // app/js/core/player-focus.js
  var require_player_focus = __commonJS({
    "app/js/core/player-focus.js"(exports, module) {
      var FOCUS_SELECTOR = "button:not(:disabled), [tabindex='0']";
      var currentEl = null;
      var keyHandler = null;
      var onFocusChange = null;
      var getZones = null;
      function setZoneProvider(fn) {
        getZones = fn;
      }
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
      function clearFocus() {
        var all = document.querySelectorAll(".player-chrome .tv-focus");
        for (var i = 0; i < all.length; i++) {
          all[i].classList.remove("tv-focus");
        }
      }
      function focusElement(el) {
        if (!el) return false;
        clearFocus();
        currentEl = el;
        el.classList.add("tv-focus");
        if (el.scrollIntoView) {
          try {
            el.scrollIntoView({ block: "nearest", inline: "nearest" });
          } catch (err) {
            el.scrollIntoView(false);
          }
        }
        if (onFocusChange) {
          var label = el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 40);
          onFocusChange(label);
        }
        return true;
      }
      function getZoneRow(el) {
        if (!el) return null;
        var row = el.closest("[data-player-zone]");
        return row ? row.getAttribute("data-player-zone") : null;
      }
      function getRowFocusables(zoneId) {
        if (!getZones) return [];
        var zones = getZones();
        var row = zones[zoneId];
        return row ? getFocusables(row) : [];
      }
      function indexInRow(el) {
        var zone = getZoneRow(el);
        var list = getRowFocusables(zone);
        for (var i = 0; i < list.length; i++) {
          if (list[i] === el) return i;
        }
        return -1;
      }
      function zoneOrder() {
        return ["top", "progress", "dock", "rail", "panel"];
      }
      function moveHorizontal(el, dir) {
        var zone = getZoneRow(el);
        var list = getRowFocusables(zone);
        var idx = indexInRow(el);
        if (idx < 0 || !list.length) return null;
        var next = idx + dir;
        if (next < 0 || next >= list.length) return null;
        return list[next];
      }
      function moveVertical(el, dir) {
        var order = zoneOrder();
        var zone = getZoneRow(el);
        var zIdx = -1;
        for (var i = 0; i < order.length; i++) {
          if (order[i] === zone) {
            zIdx = i;
            break;
          }
        }
        if (zIdx < 0) return null;
        var nextZ = zIdx + dir;
        while (nextZ >= 0 && nextZ < order.length) {
          var list = getRowFocusables(order[nextZ]);
          if (list.length) {
            var idx = indexInRow(el);
            if (idx >= 0 && idx < list.length) return list[idx];
            return list[0];
          }
          nextZ += dir;
        }
        return null;
      }
      function onKeyDown(e) {
        if (!document.body.classList.contains("is-playing")) return false;
        if (!currentEl) return false;
        var key = e.key || "";
        var code = e.keyCode;
        var isLeft = key === "ArrowLeft" || code === 37;
        var isRight = key === "ArrowRight" || code === 39;
        var isUp = key === "ArrowUp" || code === 38;
        var isDown = key === "ArrowDown" || code === 40;
        var isEnter = code === 13 || key === "Enter";
        if (isEnter) {
          if (currentEl.click) currentEl.click();
          e.preventDefault();
          return true;
        }
        var next = null;
        if (isLeft) next = moveHorizontal(currentEl, -1);
        else if (isRight) next = moveHorizontal(currentEl, 1);
        else if (isUp) next = moveVertical(currentEl, -1);
        else if (isDown) next = moveVertical(currentEl, 1);
        if (next && next !== currentEl) {
          focusElement(next);
        }
        if (isLeft || isRight || isUp || isDown) {
          e.preventDefault();
          return true;
        }
        return false;
      }
      function focusDefault() {
        var list = getRowFocusables("dock");
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === "playerPlayPause") return focusElement(list[i]);
        }
        if (list.length) return focusElement(list[0]);
        list = getRowFocusables("top");
        if (list.length) return focusElement(list[0]);
        return false;
      }
      function init2(cb) {
        onFocusChange = cb || null;
        if (keyHandler) document.removeEventListener("keydown", keyHandler, true);
        keyHandler = function(e) {
          onKeyDown(e);
        };
        document.addEventListener("keydown", keyHandler, true);
      }
      function destroy() {
        if (keyHandler) {
          document.removeEventListener("keydown", keyHandler, true);
          keyHandler = null;
        }
        clearFocus();
        currentEl = null;
        getZones = null;
      }
      module.exports = {
        init: init2,
        destroy,
        focusElement,
        focusDefault,
        setZoneProvider,
        getCurrent: function() {
          return currentEl;
        }
      };
    }
  });

  // app/js/core/keys.js
  var require_keys = __commonJS({
    "app/js/core/keys.js"(exports, module) {
      function isBackKey(e) {
        if (!e) return false;
        if (e.key === "Back" || e.key === "Escape") return true;
        var code = e.keyCode;
        return code === 10009 || code === 461;
      }
      module.exports = {
        isBackKey
      };
    }
  });

  // app/js/components/player-chrome.js
  var require_player_chrome = __commonJS({
    "app/js/components/player-chrome.js"(exports, module) {
      var player2 = require_player();
      var playerFocus = require_player_focus();
      var api = require_api();
      var config2 = require_config();
      var playbackSession = require_playback_session();
      var keys2 = require_keys();
      var chromeEl = null;
      var handlers = {};
      var hideTimer = null;
      var timeThrottle = 0;
      var railOpen = false;
      var panelOpen = null;
      var providersCache = null;
      var HIDE_MS = 5e3;
      var VIDKING_SERVERS = ["Oxygen", "Titanium", "Helium", "Hydrogen", "Lithium"];
      function escapeHtml(text) {
        if (!text) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }
      function formatTime(seconds) {
        if (!seconds || seconds < 0 || !isFinite(seconds)) return "0:00";
        var s = Math.floor(seconds);
        var h = Math.floor(s / 3600);
        var m = Math.floor(s % 3600 / 60);
        var sec = s % 60;
        var mm = m < 10 ? "0" + m : String(m);
        var ss = sec < 10 ? "0" + sec : String(sec);
        if (h > 0) return h + ":" + mm + ":" + ss;
        return m + ":" + ss;
      }
      function iconBack() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
      }
      function iconRewind() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="15" text-anchor="middle" font-size="7" fill="currentColor">10</text></svg>';
      }
      function iconForward() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="15" text-anchor="middle" font-size="7" fill="currentColor">10</text></svg>';
      }
      function iconPlay() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
      }
      function iconPause() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
      }
      function iconEpisodes() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/></svg>';
      }
      function iconSubtitles() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM6 13h2v2H6v-2zm10 0h4v2h-4v-2zm-6 4h8v2h-8v-2zm-4-8h12v2H6V9z"/></svg>';
      }
      function iconServer() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v4H4V7zm0 6h16v4H4v-4zm0 6h16v2H4v-2z"/></svg>';
      }
      function iconQuality() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 11h2v6H7v-6zm4-3h2v9h-2V8zm4 6h2v3h-2v-3z"/></svg>';
      }
      function iconNext() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zm2.5-6l4.5 3.36V8.64L8.5 12zM16 6v12h2V6h-2z"/></svg>';
      }
      function iconVolume() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
      }
      function iconVolumeMuted() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
      }
      function iconSettings() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>';
      }
      function buildDockTitle(session) {
        if (!session) return "";
        if (session.type === "tv") {
          var epTitle = session.episodeTitle || "";
          return (session.showTitle || session.title || "") + " E" + (session.episode || "") + (epTitle ? " " + epTitle : "");
        }
        return session.displayTitle || session.title || "";
      }
      function resetHideTimer() {
        if (hideTimer) clearTimeout(hideTimer);
        if (panelOpen || railOpen) return;
        hideTimer = setTimeout(function() {
          hide();
        }, HIDE_MS);
      }
      function show() {
        if (!chromeEl) return;
        chromeEl.classList.remove("player-chrome-hidden");
        chromeEl.classList.add("player-chrome-visible");
        resetHideTimer();
      }
      function hide() {
        if (!chromeEl || panelOpen || railOpen) return;
        chromeEl.classList.remove("player-chrome-visible");
        chromeEl.classList.add("player-chrome-hidden");
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
      }
      function isVisible() {
        return chromeEl && chromeEl.classList.contains("player-chrome-visible");
      }
      function closePanel() {
        if (!chromeEl) return;
        panelOpen = null;
        var panel = chromeEl.querySelector(".player-panel");
        if (panel) {
          panel.classList.add("hidden");
          panel.innerHTML = "";
          panel._panelDelegationBound = false;
        }
        resetHideTimer();
        playerFocus.focusDefault();
      }
      function closeRail() {
        railOpen = false;
        if (!chromeEl) return;
        chromeEl.classList.remove("player-chrome-rail-open");
        var rail = chromeEl.querySelector(".player-rail");
        if (rail) rail.classList.add("hidden");
        resetHideTimer();
        playerFocus.focusDefault();
      }
      function openPanel(name) {
        if (!chromeEl) return;
        closeRail();
        panelOpen = name;
        show();
        var panel = chromeEl.querySelector(".player-panel");
        if (!panel) return;
        panel.classList.remove("hidden");
        if (name === "subs") renderSubsPanel(panel);
        else if (name === "server") renderServerPanel(panel);
        else if (name === "quality") renderQualityPanel(panel);
        else if (name === "settings") renderSettingsPanel(panel);
        if (hideTimer) clearTimeout(hideTimer);
        var first = panel.querySelector("button");
        if (first) playerFocus.focusElement(first);
      }
      function toggleRail() {
        if (!chromeEl) return;
        closePanel();
        railOpen = !railOpen;
        var rail = chromeEl.querySelector(".player-rail");
        if (!rail) return;
        if (railOpen) {
          rail.classList.remove("hidden");
          chromeEl.classList.add("player-chrome-rail-open");
          show();
          loadRailEpisodes(rail);
          if (hideTimer) clearTimeout(hideTimer);
        } else {
          rail.classList.add("hidden");
          chromeEl.classList.remove("player-chrome-rail-open");
          resetHideTimer();
        }
      }
      function renderSubsPanel(panel) {
        var session = playbackSession.get();
        var subs = session && session.subtitles || [];
        var html = '<h3 class="player-panel-title">Audio &amp; Subtitles</h3><div data-player-zone="panel">';
        html += '<button type="button" class="player-panel-item focusable" data-sub-index="-1" aria-label="Subtitles off">Off</button>';
        for (var i = 0; i < subs.length; i++) {
          var label = subs[i].label || subs[i].language || "Track " + (i + 1);
          html += '<button type="button" class="player-panel-item focusable" data-sub-index="' + i + '" aria-label="' + escapeHtml(label) + '">' + escapeHtml(label) + "</button>";
        }
        html += "</div>";
        panel.innerHTML = html;
        bindPanelItems(panel, function(btn) {
          var idx = parseInt(btn.getAttribute("data-sub-index"), 10);
          if (handlers.onSubtitleSelect) handlers.onSubtitleSelect(idx);
          closePanel();
        });
      }
      function renderQualityPanel(panel) {
        var hls = player2.getHlsInstance();
        var options = player2.getQualityOptions(hls);
        var pref = config2.getQualityPreference();
        var current = player2.getCurrentQuality(hls, document.getElementById("video"));
        var html = '<h3 class="player-panel-title">Quality</h3><div data-player-zone="panel">';
        if (current && current.badge && current.badge !== "\u2014") {
          html += '<p class="player-panel-hint">Now playing: ' + escapeHtml(current.badge) + "</p>";
        }
        if (!options.length) {
          html += '<p class="player-panel-hint">Quality options appear once the stream loads.</p>';
        } else {
          var autoActive = pref.mode === "auto" ? " is-active" : "";
          html += '<button type="button" class="player-panel-item focusable' + autoActive + '" data-quality-level="-1" aria-label="Quality Auto">Auto</button>';
          for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            var active = pref.mode === "manual" && pref.level === opt.level ? " is-active" : "";
            html += '<button type="button" class="player-panel-item focusable' + active + '" data-quality-level="' + opt.level + '" aria-label="Quality ' + escapeHtml(opt.label) + '">' + escapeHtml(opt.label) + "</button>";
          }
        }
        html += "</div>";
        panel.innerHTML = html;
        bindPanelItems(panel, function(btn) {
          var raw = btn.getAttribute("data-quality-level");
          if (raw === null || raw === "" || !handlers.onQualitySelect) return;
          var level = parseInt(raw, 10);
          if (isNaN(level)) return;
          handlers.onQualitySelect(level);
          closePanel();
        });
      }
      function renderSettingsPanel(panel) {
        var speed = config2.getPlaybackSpeed();
        var html = '<h3 class="player-panel-title">Settings</h3><div data-player-zone="panel">';
        html += '<p class="player-panel-hint">Playback speed</p><button type="button" class="player-panel-item focusable is-active" data-speed="cycle" aria-label="Playback speed">' + speed + "x</button>";
        html += "</div>";
        panel.innerHTML = html;
        bindPanelItems(panel, function(btn) {
          if (btn.getAttribute("data-speed") && handlers.onSpeedCycle) handlers.onSpeedCycle();
          closePanel();
        });
      }
      function formatSourceLabel(src) {
        var label = src.label || src.provider || src.sourceId || "Source";
        if (!src.audioLanguage && src.audioVariant !== "original" && src.audioVariant !== "dubbed") {
          return label;
        }
        var hint = "";
        if (src.audioVariant === "original") {
          hint = (src.audioLanguage ? src.audioLanguage.toUpperCase() + " " : "") + "original";
        } else if (src.audioVariant === "dubbed") {
          hint = (src.audioLanguage ? src.audioLanguage.toUpperCase() + " " : "") + "dub";
        } else if (src.audioLanguage) {
          hint = src.audioLanguage.toUpperCase();
        }
        if (hint) return label + " \xB7 " + hint;
        return label;
      }
      function renderServerPanel(panel) {
        var session = playbackSession.get();
        var activeProviderId = session && session.sources && session.sources[session.currentSourceIndex || 0] ? session.sources[session.currentSourceIndex || 0].providerId : null;
        var html = '<h3 class="player-panel-title">Server</h3><div data-player-zone="panel">';
        html += '<p class="player-panel-hint">Providers</p>';
        html += '<div class="player-panel-providers" data-provider-list>Loading providers\u2026</div>';
        html += '<p class="player-panel-hint">Stream sources</p>';
        var sources = session && session.sources || [];
        for (var i = 0; i < sources.length; i++) {
          var src = sources[i];
          var label = formatSourceLabel(src);
          var active = session && session.currentSourceIndex === i ? " is-active" : "";
          html += '<button type="button" class="player-panel-item focusable' + active + '" data-source-index="' + i + '" aria-label="' + escapeHtml(label) + '">' + escapeHtml(label) + "</button>";
        }
        html += '<p class="player-panel-hint">CDN fallback (Vidking)</p>';
        for (var v = 0; v < VIDKING_SERVERS.length; v++) {
          var server = VIDKING_SERVERS[v];
          html += '<button type="button" class="player-panel-item focusable" data-vidking="' + escapeHtml(server) + '" aria-label="Vidking ' + escapeHtml(server) + '">' + escapeHtml(server) + "</button>";
        }
        html += "</div>";
        panel.innerHTML = html;
        bindPanelDelegation(panel, function(btn) {
          if (btn.hasAttribute("data-source-index")) {
            var idx = parseInt(btn.getAttribute("data-source-index"), 10);
            if (!isNaN(idx) && handlers.onSourceSwitch) handlers.onSourceSwitch(idx);
            return;
          }
          var vk = btn.getAttribute("data-vidking");
          if (vk && handlers.onReResolve) {
            handlers.onReResolve({ server: vk, backend: "vidking" });
            return;
          }
          var providerId = btn.getAttribute("data-provider-id");
          if (providerId && handlers.onReResolve) {
            config2.setPreferredProviderId(providerId);
            handlers.onReResolve({ providerId, backend: "streamflix" });
          }
        });
        loadStreamflixProviders(panel, activeProviderId);
      }
      function loadStreamflixProviders(panel, activeProviderId) {
        var container = panel.querySelector("[data-provider-list]");
        if (!container) return;
        function renderList(providers) {
          var session = playbackSession.get();
          var html = "";
          if (!providers || !providers.length) {
            container.textContent = "No providers";
            return;
          }
          for (var i = 0; i < providers.length; i++) {
            var p = providers[i];
            if (p.implementationStatus === "stub") continue;
            var id = p.id || "";
            if (!id) continue;
            var label = p.name || id;
            var health = p.health;
            var healthTxt = health ? " \xB7 " + health.successes + " ok / " + health.failures + " fail" : "";
            var active = activeProviderId === id ? " is-active" : "";
            var enabled = p.enabled !== false;
            html += '<button type="button" class="player-panel-item focusable' + active + (enabled ? "" : " is-disabled") + '" data-provider-id="' + escapeHtml(id) + '" aria-label="' + escapeHtml(label) + '">' + escapeHtml(label) + " [" + escapeHtml(p.language || "?") + "]" + escapeHtml(healthTxt) + "</button>";
          }
          container.innerHTML = html || "<p>No providers</p>";
        }
        if (providersCache) {
          renderList(providersCache);
          return;
        }
        api.getStreamflixProviders().then(function(data) {
          providersCache = data.providers || [];
          renderList(providersCache);
        }).catch(function() {
          container.textContent = "Providers unavailable";
        });
      }
      function bindPanelItems(panel, onClick) {
        var buttons = panel.querySelectorAll(".player-panel-item");
        for (var i = 0; i < buttons.length; i++) {
          (function(btn) {
            btn.addEventListener("click", function() {
              onClick(btn);
            });
          })(buttons[i]);
        }
      }
      function bindPanelDelegation(panel, onClick) {
        if (panel._panelDelegationBound) return;
        panel._panelDelegationBound = true;
        panel.addEventListener("click", function(e) {
          var btn = e.target;
          while (btn && btn !== panel) {
            if (btn.classList && btn.classList.contains("player-panel-item")) {
              onClick(btn);
              return;
            }
            btn = btn.parentNode;
          }
        });
      }
      function loadRailEpisodes(rail) {
        var session = playbackSession.get();
        if (!session || session.type !== "tv") return;
        var list = rail.querySelector(".player-rail-list");
        if (!list) return;
        list.innerHTML = '<div class="loading-msg">Loading episodes\u2026</div>';
        api.getEpisodes(session.tmdbId, session.season).then(function(data) {
          var episodes = data.episodes || [];
          list.innerHTML = "";
          for (var i = 0; i < episodes.length; i++) {
            (function(ep) {
              var active = ep.episode === session.episode ? " player-rail-card-active" : "";
              var still = ep.still ? ` style="background-image:url('` + escapeHtml(ep.still) + `')"` : "";
              var card = document.createElement("button");
              card.type = "button";
              card.className = "player-rail-card focusable" + active;
              card.setAttribute("data-player-zone", "rail");
              card.setAttribute("aria-label", "Episode " + ep.episode);
              card.innerHTML = '<div class="player-rail-thumb"' + still + '></div><div class="player-rail-meta"><strong>' + ep.episode + ". " + escapeHtml(ep.title) + "</strong></div>";
              card.addEventListener("click", function() {
                if (String(session.episode) === String(ep.episode)) {
                  closeRail();
                  return;
                }
                list.innerHTML = '<div class="loading-msg">Loading episode\u2026</div>';
                if (handlers.onEpisodeSelect) {
                  handlers.onEpisodeSelect(session.tmdbId, session.season, ep.episode, ep.title, ep.overview);
                }
                closeRail();
              });
              list.appendChild(card);
            })(episodes[i]);
          }
          var focusCard = list.querySelector(".player-rail-card-active") || list.querySelector(".player-rail-card");
          if (focusCard) playerFocus.focusElement(focusCard);
        }).catch(function(err) {
          list.innerHTML = '<div class="error-banner">' + escapeHtml(err.message) + "</div>";
        });
      }
      function updatePlayPauseIcon(video) {
        if (!chromeEl || !video) return;
        var btn = chromeEl.querySelector("#playerPlayPause");
        if (!btn) return;
        btn.innerHTML = video.paused ? iconPlay() : iconPause();
        btn.setAttribute("aria-label", video.paused ? "Play" : "Pause");
      }
      function updateVolumeIcon(video) {
        if (!chromeEl || !video) return;
        var btn = chromeEl.querySelector("#playerVolume");
        if (!btn) return;
        btn.innerHTML = video.muted ? iconVolumeMuted() : iconVolume();
        btn.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
      }
      function updateProgress(video) {
        if (!chromeEl || !video) return;
        var now = Date.now();
        if (now - timeThrottle < 250 && video.paused === false) return;
        timeThrottle = now;
        var duration = video.duration;
        var current = video.currentTime;
        if (!duration || !isFinite(duration)) duration = 0;
        var pct = duration > 0 ? current / duration * 100 : 0;
        var fill = chromeEl.querySelector(".player-progress-fill");
        var scrub = chromeEl.querySelector(".player-progress-scrub");
        var timeEl = chromeEl.querySelector(".player-progress-time");
        if (fill) fill.style.width = pct + "%";
        if (scrub) scrub.style.left = pct + "%";
        if (timeEl) timeEl.textContent = formatTime(Math.max(0, duration - current));
      }
      function bindVideoEvents(video) {
        if (!video || video._playerChromeBound) return;
        video._playerChromeBound = true;
        video.addEventListener("timeupdate", function() {
          updateProgress(video);
        });
        video.addEventListener("play", function() {
          updatePlayPauseIcon(video);
        });
        video.addEventListener("pause", function() {
          updatePlayPauseIcon(video);
        });
        video.addEventListener("loadedmetadata", function() {
          updateProgress(video);
        });
        video.addEventListener("volumechange", function() {
          updateVolumeIcon(video);
        });
      }
      function updateQualityBadge(info) {
        if (!chromeEl) return;
        var badge = chromeEl.querySelector("#playerQualityBadge");
        if (!badge) return;
        var text = info && info.badge ? info.badge : info && info.label ? info.label : "\u2014";
        badge.textContent = text;
        badge.setAttribute("aria-label", "Current quality " + text);
      }
      function getZones() {
        if (!chromeEl) return {};
        return {
          top: chromeEl.querySelector('[data-player-zone="top"]'),
          progress: chromeEl.querySelector('[data-player-zone="progress"]'),
          dock: chromeEl.querySelector('[data-player-zone="dock"]'),
          rail: chromeEl.querySelector(".player-rail"),
          panel: chromeEl.querySelector(".player-panel")
        };
      }
      function mount(session, h) {
        handlers = h || {};
        var wrap = document.getElementById("videoWrap");
        if (!wrap) return;
        destroy();
        var isTv = session && session.type === "tv";
        var hasNext = session && session.nextEpisode;
        chromeEl = document.createElement("div");
        chromeEl.className = "player-chrome player-chrome-visible";
        chromeEl.innerHTML = '<div class="player-vignette-top"></div><div class="player-vignette-bottom"></div><div class="player-top" data-player-zone="top"><div class="player-top-group"><button type="button" class="player-icon-btn focusable" id="playerBack" aria-label="Back">' + iconBack() + '</button><button type="button" class="player-icon-btn focusable" id="playerServer" aria-label="Server">' + iconServer() + '</button></div><span id="playerQualityBadge" class="player-quality-badge" aria-label="Current quality">\u2014</span></div><div class="player-progress-wrap" data-player-zone="progress"><span class="player-progress-time">0:00</span><div class="player-progress-track"><div class="player-progress-fill"></div><div class="player-progress-scrub"></div></div></div><div class="player-dock" data-player-zone="dock"><div class="player-dock-left"><button type="button" class="player-dock-btn focusable" id="playerPlayPause" aria-label="Pause">' + iconPause() + '</button><button type="button" class="player-dock-btn focusable" id="playerRewind" aria-label="Rewind 10 seconds">' + iconRewind() + '</button><button type="button" class="player-dock-btn focusable" id="playerForward" aria-label="Forward 10 seconds">' + iconForward() + '</button><button type="button" class="player-dock-btn focusable" id="playerVolume" aria-label="Mute">' + iconVolume() + '</button></div><div class="player-dock-title">' + escapeHtml(buildDockTitle(session)) + '</div><div class="player-dock-right">' + (isTv && hasNext ? '<button type="button" class="player-dock-btn focusable" id="playerNext" aria-label="Next episode">' + iconNext() + "</button>" : "") + (isTv ? '<button type="button" class="player-dock-btn focusable" id="playerEpisodes" aria-label="Episodes">' + iconEpisodes() + "</button>" : "") + '<button type="button" class="player-dock-btn focusable" id="playerSubs" aria-label="Audio and Subtitles">' + iconSubtitles() + '</button><button type="button" class="player-dock-btn focusable" id="playerQuality" aria-label="Quality">' + iconQuality() + '</button><button type="button" class="player-dock-btn focusable" id="playerSettings" aria-label="Settings">' + iconSettings() + '</button></div></div><div class="player-rail hidden"><div class="player-rail-header">Episodes</div><div class="player-rail-list"></div></div><div class="player-panel hidden"></div>';
        wrap.appendChild(chromeEl);
        var video = document.getElementById("video");
        bindVideoEvents(video);
        updateProgress(video);
        updatePlayPauseIcon(video);
        updateVolumeIcon(video);
        playerFocus.setZoneProvider(getZones);
        playerFocus.init(handlers.onFocusChange);
        playerFocus.focusDefault();
        chromeEl.querySelector("#playerBack").addEventListener("click", function() {
          handleUiBack();
        });
        chromeEl.querySelector("#playerServer").addEventListener("click", function() {
          openPanel("server");
        });
        chromeEl.querySelector("#playerRewind").addEventListener("click", function() {
          if (handlers.onSeek) handlers.onSeek(-10);
          resetHideTimer();
        });
        chromeEl.querySelector("#playerForward").addEventListener("click", function() {
          if (handlers.onSeek) handlers.onSeek(10);
          resetHideTimer();
        });
        chromeEl.querySelector("#playerPlayPause").addEventListener("click", function() {
          if (handlers.onPlayPause) handlers.onPlayPause();
          resetHideTimer();
        });
        chromeEl.querySelector("#playerVolume").addEventListener("click", function() {
          video.muted = !video.muted;
          updateVolumeIcon(video);
          resetHideTimer();
        });
        var epBtn = chromeEl.querySelector("#playerEpisodes");
        if (epBtn) {
          epBtn.addEventListener("click", function() {
            toggleRail();
          });
        }
        chromeEl.querySelector("#playerSubs").addEventListener("click", function() {
          openPanel("subs");
        });
        chromeEl.querySelector("#playerQuality").addEventListener("click", function() {
          openPanel("quality");
        });
        chromeEl.querySelector("#playerSettings").addEventListener("click", function() {
          openPanel("settings");
        });
        var nextBtn = chromeEl.querySelector("#playerNext");
        if (nextBtn) {
          nextBtn.addEventListener("click", function() {
            if (handlers.onNextEpisode) handlers.onNextEpisode();
          });
        }
        var progressBtn = chromeEl.querySelector(".player-progress-wrap");
        if (progressBtn) {
          progressBtn.setAttribute("tabindex", "0");
          progressBtn.classList.add("focusable");
          progressBtn.addEventListener("click", function() {
            if (handlers.onPlayPause) handlers.onPlayPause();
          });
        }
        document.addEventListener("keydown", onActivity, true);
        document.addEventListener("mousedown", onActivity, true);
        resetHideTimer();
      }
      function onActivity(e) {
        if (!document.body.classList.contains("is-playing")) return;
        if (e.type === "keydown") {
          if (keys2.isBackKey(e)) return;
        }
        show();
        resetHideTimer();
      }
      function handleBack() {
        if (panelOpen) {
          closePanel();
          return true;
        }
        if (railOpen) {
          closeRail();
          return true;
        }
        if (handlers.onStop) handlers.onStop();
        return true;
      }
      function handleUiBack() {
        handleBack();
      }
      function destroy() {
        document.removeEventListener("keydown", onActivity, true);
        document.removeEventListener("mousedown", onActivity, true);
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        playerFocus.destroy();
        if (chromeEl && chromeEl.parentNode) {
          chromeEl.parentNode.removeChild(chromeEl);
        }
        chromeEl = null;
        railOpen = false;
        panelOpen = null;
        handlers = {};
      }
      module.exports = {
        mount,
        destroy,
        show,
        hide,
        isVisible,
        handleBack,
        closePanel,
        closeRail,
        updateProgress,
        updatePlayPauseIcon,
        updateQualityBadge
      };
    }
  });

  // app/js/services/playback.js
  var require_playback = __commonJS({
    "app/js/services/playback.js"(exports, module) {
      var api = require_api();
      var config2 = require_config();
      var player2 = require_player();
      var debug2 = require_debug();
      var playbackSession = require_playback_session();
      var playerChrome = require_player_chrome();
      var VIDKING_SERVER_FALLBACKS = [
        { label: "Oxygen", query: "server=Oxygen&backend=vidking", timeoutMs: 15e3 },
        { label: "Titanium", query: "server=Titanium&backend=vidking", timeoutMs: 15e3 },
        { label: "Helium", query: "server=Helium&backend=vidking", timeoutMs: 15e3 },
        { label: "Hydrogen", query: "server=Hydrogen&backend=vidking", timeoutMs: 15e3 },
        { label: "Lithium", query: "server=Lithium&backend=vidking", timeoutMs: 15e3 }
      ];
      var VIDKING_SERVER_NAMES = ["Oxygen", "Titanium", "Helium", "Hydrogen", "Lithium"];
      var PRIMARY_RESOLVE_TIMEOUT_MS = 9e4;
      var ANIME_PROVIDER_ORDER = ["hianime", "anikoto", "ani-world", "anime-world"];
      var EN_PROVIDER_ORDER = ["sflix", "ridomovies", "superstream", "streaming-community-en", "anymovie"];
      var TMDB_BACKUP_QUERY = "backend=tmdb-native&sources=twoembed,vidrock,vidsrcnet,vidzee";
      var playSession = 0;
      var progressSaveTimer = null;
      var lastProgressSaveAt = 0;
      var PROGRESS_SAVE_INTERVAL_MS = 3e4;
      var autoplayTimer = null;
      var autoplayEndedHandler = null;
      var qualityUnsubscribe = null;
      var lastKnownPlayingHeight = 0;
      var qualityUpgradeAttempted = false;
      var pendingQualityUpgrade = null;
      function unbindQualityWatcher() {
        if (qualityUnsubscribe) {
          qualityUnsubscribe();
          qualityUnsubscribe = null;
        }
      }
      function bindQualityWatcher() {
        unbindQualityWatcher();
        var video = document.getElementById("video");
        qualityUnsubscribe = player2.onQualityChange(function(info) {
          if (info.height) lastKnownPlayingHeight = info.height;
          playerChrome.updateQualityBadge(info);
          if (!pendingQualityUpgrade || qualityUpgradeAttempted) return;
          var targetPx = config2.targetResolutionPixels(config2.getTargetResolution());
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
        playerChrome.updateQualityBadge(player2.getCurrentQuality(player2.getHlsInstance(), video));
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
        if (!video || !config2.getAutoplayNext()) return;
        autoplayEndedHandler = function() {
          var session = playbackSession.get();
          if (!session || session.type !== "tv" || !session.nextEpisode) return;
          var bufferSec = config2.getAutoplayBufferSec();
          var remaining = bufferSec;
          if (onStatus) onStatus("Next episode in " + remaining + "s\u2026");
          clearAutoplayTimer();
          autoplayTimer = setInterval(function() {
            remaining -= 1;
            if (remaining > 0) {
              if (onStatus) onStatus("Next episode in " + remaining + "s\u2026");
              return;
            }
            clearAutoplayTimer();
            var handlers = buildChromeHandlers(onStatus);
            if (handlers.onNextEpisode) handlers.onNextEpisode();
          }, 1e3);
        };
        video.addEventListener("ended", autoplayEndedHandler);
      }
      function buildProgressPayload(video) {
        var session = playbackSession.get();
        if (!session || !session.tmdbId) return null;
        var duration = video && video.duration && isFinite(video.duration) ? video.duration : 0;
        var position = video && video.currentTime ? video.currentTime : 0;
        if (duration <= 0 || position <= 0) return null;
        var poster = session.poster || session.play && session.play.poster || null;
        return {
          tmdbId: String(session.tmdbId),
          type: session.type || "movie",
          season: session.type === "tv" ? session.season : void 0,
          episode: session.type === "tv" ? session.episode : void 0,
          title: session.showTitle || session.title || "",
          poster,
          positionSeconds: Math.floor(position),
          durationSeconds: Math.floor(duration)
        };
      }
      function savePlaybackProgress(video, force) {
        if (!video) return;
        var payload = buildProgressPayload(video);
        if (!payload) return;
        var now = Date.now();
        if (!force && now - lastProgressSaveAt < PROGRESS_SAVE_INTERVAL_MS) return;
        lastProgressSaveAt = now;
        api.saveProgress(payload).catch(function() {
        });
      }
      function bindProgressSaver(video) {
        unbindProgressSaver();
        if (!video) return;
        progressSaveTimer = function() {
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
          return "Cannot reach API at " + api.getBase() + ". Open Settings, set API URL to your PC's LAN address (port 8790), and ensure tizenflix-api is running.";
        }
        if (msg.indexOf("timed out") !== -1) {
          return "Stream lookup timed out. Could not find a playable source.";
        }
        return msg;
      }
      function ensureApiReachable() {
        var base = api.getBase();
        debug2.debugLog("API: " + base);
        return api.health().catch(function() {
          throw new Error(
            "Cannot reach API at " + base + ". Open Settings, set API URL to your PC's LAN address (port 8790), and ensure tizenflix-api is running."
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
          debug2.debugLog(msg);
          if (onStatus) onStatus(msg);
        }
        return {
          onFocusChange: function(label) {
            if (window.TizenflixApp && window.TizenflixApp.updateFocusHint) {
              window.TizenflixApp.updateFocusHint(label);
            }
          },
          onStop: function() {
            stop();
          },
          onSeek: function(delta) {
            player2.seekBy(video, delta);
            playerChrome.updateProgress(video);
          },
          onPlayPause: function() {
            player2.togglePlayPause(video, log);
            playerChrome.updatePlayPauseIcon(video);
          },
          onSubtitleSelect: function(index) {
            player2.selectSubtitle(video, index);
            playbackSession.update({ activeSubtitleIndex: index });
          },
          onSourceSwitch: function(index) {
            switchSource(index, onStatus).catch(function(err) {
              log(err.message);
            });
          },
          onQualitySelect: function(level) {
            var hls = player2.getHlsInstance();
            var video2 = document.getElementById("video");
            if (level < 0) {
              config2.setQualityAuto();
              if (hls) {
                player2.setQualityLevel(hls, -1);
              } else {
                playerChrome.updateQualityBadge(player2.getCurrentQuality(null, video2));
              }
              log("Quality: Auto");
              return;
            }
            config2.setQualityLevel(level);
            if (hls) {
              player2.setQualityLevel(hls, level);
              var info = player2.getCurrentQuality(hls, video2);
              log("Quality: " + (info.label || level));
              return;
            }
            var stored = playbackSession.get();
            if (!stored || !stored.sources.length) {
              log("Quality: stream not ready");
              return;
            }
            if (video2 && video2.currentTime > 0) {
              player2.setResumePosition(video2.currentTime);
            }
            var sourceIndex = stored.currentSourceIndex || 0;
            switchSource(sourceIndex, onStatus).then(function() {
              var newHls = player2.getHlsInstance();
              if (newHls) player2.setQualityLevel(newHls, level);
            }).catch(function(err) {
              log(err.message);
            });
            log("Quality: switching to level " + level);
          },
          onSpeedCycle: function() {
            var next = config2.cyclePlaybackSpeed();
            video.playbackRate = next;
            log("Speed: " + next + "x");
          },
          onReResolve: function(overrides) {
            reResolveWith(overrides, onStatus).catch(function(err) {
              log(err.message);
            });
          },
          onEpisodeSelect: function(tmdbId, season, episode, episodeTitle, overview) {
            var session = playbackSession.get();
            if (session && String(session.season) === String(season) && String(session.episode) === String(episode)) {
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
                showTitle,
                episodeTitle,
                overview,
                metaLine: session ? session.metaLine : ""
              }
            ).catch(function(err) {
              log(err.message);
            });
          },
          onNextEpisode: function() {
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
              { showTitle, metaLine: session.metaLine }
            ).catch(function(err) {
              log(err.message);
            });
          }
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
        if (video) player2.destroyPlayer(video);
        playbackSession.create(meta);
        enterFullscreenPlayback();
        if (wrap) {
          wrap.classList.remove("hidden");
          player2.showPlaybackChrome(wrap, meta.displayTitle || meta.title || "");
        }
        mountChrome(playbackSession.get(), onStatus);
        debug2.debugClear();
        debug2.debugLog("Resolving: " + (meta.displayTitle || meta.title || ""));
        if (onStatus) onStatus("Resolving...");
        return session;
      }
      function isCdnPlaybackError(reason) {
        if (!reason) return false;
        return /HTTP (521|502|503|403|404)|manifestLoadError|networkError/i.test(String(reason));
      }
      function resolveWithTizenFallback(resolveAttempts, onStatus, session) {
        var chain = Promise.resolve({ play: null, via: null, tierIndex: -1 });
        for (var i = 0; i < resolveAttempts.length; i++) {
          (function(entry, tierIndex) {
            chain = chain.then(function(prev) {
              if (!isActivePlaySession(session)) return prev;
              if (prev.play && api.hasPlayableSources(prev.play)) return prev;
              var msg = "Trying " + entry.label + "\u2026";
              debug2.debugLog(msg);
              if (onStatus) onStatus(msg);
              return entry.run().then(function(play) {
                if (play && api.hasPlayableSources(play)) {
                  return { play, via: entry.label, tierIndex };
                }
                return prev;
              }).catch(function(err) {
                debug2.debugLog("Resolve failed (" + entry.label + "): " + err.message);
                return prev;
              });
            });
          })(resolveAttempts[i], i);
        }
        return chain.then(function(result) {
          if (result.via && result.play) {
            debug2.debugLog("Resolved via: " + result.via);
            if (onStatus) onStatus("Resolved via: " + result.via);
          }
          var fallbacks = result.tierIndex >= 0 ? resolveAttempts.slice(result.tierIndex + 1) : resolveAttempts;
          return { play: result.play, via: result.via, fallbacks };
        });
      }
      function escalatePlaybackFallback(fallbacks, title, onStatus, session, playOptions) {
        if (!isActivePlaySession(session)) return Promise.resolve();
        if (!fallbacks || !fallbacks.length) {
          return Promise.reject(new Error("All sources failed \u2014 CDN may be blocking playback"));
        }
        playbackSession.clearPrefetch();
        var msg = "CDN error \u2014 trying next server\u2026";
        debug2.debugLog(msg);
        if (onStatus) onStatus(msg);
        return resolveWithTizenFallback(fallbacks, onStatus, session).then(function(result) {
          if (!isActivePlaySession(session)) return;
          if (!result.play || !api.hasPlayableSources(result.play)) {
            return Promise.reject(new Error(formatResolveError(result.play)));
          }
          if (result.via && result.play.sources && result.play.sources[0]) {
            config2.setPreferredProviderId(result.play.sources[0].providerId || null);
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
          config2.setPreferredProviderId(sources[0].providerId);
        }
        wrap.classList.remove("hidden");
        player2.showPlaybackChrome(wrap, title || play.title || "");
        player2.applySubtitles(video, play.subtitles || []);
        loadSubtitlesAsync(play, video);
        mountChrome(stored, onStatus);
        bindProgressSaver(video);
        video.playbackRate = config2.getPlaybackSpeed();
        bindAutoplayHandler(video, onStatus);
        debug2.debugLog("Playing: " + (title || play.title || ""));
        if (play.warnings && play.warnings.length) {
          for (var w = 0; w < play.warnings.length; w++) {
            if (onStatus) onStatus(play.warnings[w]);
            else debug2.debugLog(play.warnings[w]);
          }
        }
        function log(msg) {
          if (onStatus) onStatus(msg);
          else debug2.debugLog(msg);
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
          sourceOptions.onAllSourcesFailed = function(reason) {
            if (escalating || !playOptions._fallbacks || !playOptions._fallbacks.length) return;
            if (!isCdnPlaybackError(reason)) return;
            escalating = true;
            var nextFallbacks = playOptions._fallbacks;
            playOptions._fallbacks = [];
            escalatePlaybackFallback(nextFallbacks, title, onStatus, session, playOptions).catch(
              function(err) {
                escalating = false;
                log(err.message);
              }
            );
          };
        }
        player2.playSources(video, sources, log, wrap, title || play.title || "Playback", sourceOptions);
        if (playOptions._upgradeAttempts && playOptions._upgradeAttempts.length) {
          pendingQualityUpgrade = {
            session,
            play,
            title,
            onStatus,
            playOptions
          };
          setTimeout(function() {
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
          }, 5e3);
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
        promise.then(function(data) {
          if (!data || !data.subtitles || !data.subtitles.length) return;
          player2.applySubtitles(video, data.subtitles);
          playbackSession.update({ subtitles: data.subtitles });
        }).catch(function() {
        });
      }
      function buildPrimaryResolveQuery() {
        var parts = [];
        var backend = config2.getPlayBackend();
        parts.push("backend=" + backend);
        var preferred = config2.getPreferredProviderId();
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
      function currentPlayProvider(play) {
        if (!play || !play.sources || !play.sources[0]) return null;
        var s = play.sources[0];
        return s.provider || s.providerId || null;
      }
      function isAnimeProviderId(providerId) {
        return providerId && ANIME_PROVIDER_ORDER.indexOf(providerId) !== -1;
      }
      function streamflixProviderChain(startAfterId) {
        var preferred = config2.getPreferredProviderId();
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
          (function(providerId) {
            attempts.push({
              label: providerId,
              run: function() {
                var q = "providerId=" + encodeURIComponent(providerId) + "&backend=streamflix";
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
              }
            });
          })(chain[i]);
        }
        return attempts;
      }
      function buildMovieVidkingFallbacks(tmdbId) {
        var attempts = [];
        for (var i = 0; i < VIDKING_SERVER_FALLBACKS.length; i++) {
          (function(fb) {
            attempts.push({
              label: fb.label,
              run: function() {
                return api.resolveMovie(tmdbId, fb.query, fb.timeoutMs);
              }
            });
          })(VIDKING_SERVER_FALLBACKS[i]);
        }
        return attempts;
      }
      function buildTvVidkingFallbacks(tmdbId, season, episode) {
        var attempts = [];
        for (var i = 0; i < VIDKING_SERVER_FALLBACKS.length; i++) {
          (function(fb) {
            attempts.push({
              label: fb.label,
              run: function() {
                return api.resolveTvEpisode(tmdbId, season, episode, fb.query, fb.timeoutMs);
              }
            });
          })(VIDKING_SERVER_FALLBACKS[i]);
        }
        return attempts;
      }
      function buildQualityUpgradeAttempts(tmdbId, type, season, episode) {
        var backup = {
          label: "TMDB-native backups",
          run: function() {
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
          }
        };
        return [backup];
      }
      function scheduleQualityUpgrade(session, currentPlay, title, onStatus, playOptions) {
        var target = config2.getTargetResolution();
        if (target === "auto" || qualityUpgradeAttempted) return;
        var targetPx = config2.targetResolutionPixels(target);
        if (!targetPx) return;
        var currentMax = config2.maxSourceHeight(currentPlay);
        var playingH = lastKnownPlayingHeight || 0;
        if (playingH >= targetPx) return;
        if (!playingH && currentMax >= targetPx) return;
        if (!playOptions._upgradeAttempts || !playOptions._upgradeAttempts.length) return;
        qualityUpgradeAttempted = true;
        debug2.debugLog("Searching for higher quality than " + (lastKnownPlayingHeight || currentMax || "?") + "p\u2026");
        if (onStatus) onStatus("Searching for higher quality\u2026");
        resolveWithTizenFallback(playOptions._upgradeAttempts, onStatus, session).then(function(upgradeResult) {
          if (!isActivePlaySession(session)) return;
          if (!upgradeResult.play || !api.hasPlayableSources(upgradeResult.play)) return;
          var upgradeMax = config2.maxSourceHeight(upgradeResult.play);
          var playingH2 = lastKnownPlayingHeight || currentMax;
          if (upgradeMax <= playingH2) return;
          var video = document.getElementById("video");
          var pos = video && video.currentTime > 0 ? video.currentTime : 0;
          if (pos > 0) player2.setResumePosition(pos);
          var want = config2.preferredQualityForTarget(target) || target + "p";
          debug2.debugLog("Upgrading to " + want + " via " + (upgradeResult.via || "alternate server"));
          if (onStatus) onStatus("Upgrading to " + want + "\u2026");
          return playResolved(upgradeResult.play, title, onStatus, session, {
            startSeconds: pos,
            _fallbacks: playOptions._fallbacks || []
          }).then(function() {
            if (onStatus) onStatus("Now playing " + want);
          });
        }).catch(function() {
        });
      }
      function buildNextProviderFallbacks(currentProviderId, tmdbId, type, season, episode) {
        return buildStreamflixProviderFallbacks(tmdbId, type, season, episode, currentProviderId);
      }
      function buildVidkingFallbacks(tmdbId, type, season, episode) {
        return type === "tv" ? buildTvVidkingFallbacks(tmdbId, season, episode) : buildMovieVidkingFallbacks(tmdbId);
      }
      function buildVidkingFallbacksExcluding(tmdbId, type, season, episode, excludeServer) {
        var all = buildVidkingFallbacks(tmdbId, type, season, episode);
        if (!excludeServer) return all;
        var lower = String(excludeServer).toLowerCase();
        return all.filter(function(attempt) {
          return String(attempt.label).toLowerCase() !== lower;
        });
      }
      function buildPlaybackFallbacks(play, tmdbId, type, season, episode) {
        var current = currentPlayProvider(play);
        var backend = play && play.backend;
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
          parts.push("backend=vidking");
        } else if (overrides.providerId) {
          parts.push("providerId=" + encodeURIComponent(overrides.providerId));
          parts.push("backend=streamflix");
        } else if (overrides.onlySourceId) {
          parts.push("onlySourceId=" + encodeURIComponent(overrides.onlySourceId));
          parts.push("backend=tmdb-native");
        } else if (overrides.backend) {
          parts.push("backend=" + encodeURIComponent(overrides.backend));
        }
        return parts.join("&");
      }
      function handlePlaybackFailure(session, err) {
        if (!isActivePlaySession(session)) return;
        debug2.debugLog("Playback failed: " + (err && err.message ? err.message : String(err)));
        playerChrome.destroy();
        playbackSession.clear();
        player2.exitPlaybackMode();
        exitFullscreenPlayback();
        var wrap = document.getElementById("videoWrap");
        if (wrap) wrap.classList.add("hidden");
        var router = require_router();
        router.rerender();
        throw new Error(formatPlaybackError(err));
      }
      function buildEmptyResolveAttempts(tmdbId, type, season, episode, preferred) {
        var backend = config2.getPlayBackend();
        var emptyAttempts = [];
        if (backend === "vidking" || backend === "auto") {
          emptyAttempts = emptyAttempts.concat(
            buildVidkingFallbacks(tmdbId, type, season, episode)
          );
        }
        if (backend === "streamflix" || backend === "auto" || backend === "vidking") {
          emptyAttempts = emptyAttempts.concat(
            buildStreamflixProviderFallbacks(tmdbId, type, season, episode, preferred)
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
        if (onStatus) onStatus("Trying alternate servers\u2026");
        return resolveWithTizenFallback(emptyAttempts, onStatus, session).then(function(result) {
          result.fallbacks = [];
          result._upgradeAttempts = upgradeAttempts;
          return result;
        });
      }
      function resolvePlayback(tmdbId, type, season, episode, onStatus, session) {
        var query = buildPrimaryResolveQuery();
        var preferred = config2.getPreferredProviderId();
        var upgradeAttempts = buildQualityUpgradeAttempts(tmdbId, type, season, episode);
        var key = type === "tv" ? playbackSession.prefetchKey("tv", tmdbId, season, episode) : playbackSession.prefetchKey("movie", tmdbId);
        var prefetched = playbackSession.getPrefetch(key);
        if (prefetched && api.hasPlayableSources(prefetched)) {
          debug2.debugLog("Resolved via: prefetched");
          if (onStatus) onStatus("Starting playback\u2026");
          return Promise.resolve({
            play: prefetched,
            via: "prefetched",
            fallbacks: buildPlaybackFallbacks(prefetched, tmdbId, type, season, episode),
            _upgradeAttempts: upgradeAttempts
          });
        }
        return ensureApiReachable().then(function() {
          if (preferred) {
            if (onStatus) onStatus("Trying " + preferred + "\u2026");
          } else if (onStatus) {
            onStatus("Finding stream\u2026");
          }
          var resolvePromise = type === "tv" ? api.resolveTvEpisode(tmdbId, season, episode, query, PRIMARY_RESOLVE_TIMEOUT_MS) : api.resolveMovie(tmdbId, query, PRIMARY_RESOLVE_TIMEOUT_MS);
          return resolvePromise.then(function(play) {
            if (!isActivePlaySession(session)) return { play: null, fallbacks: [] };
            if (play && api.hasPlayableSources(play)) {
              var via = play.sources[0] && play.sources[0].providerId || play.sources[0] && play.sources[0].provider || play.backend || "auto";
              debug2.debugLog("Resolved via: " + via);
              if (onStatus) onStatus("Resolved via: " + via);
              if (play.warnings && play.warnings.length && onStatus) {
                onStatus("Trying fallback\u2026");
              }
              return {
                play,
                via,
                fallbacks: buildPlaybackFallbacks(play, tmdbId, type, season, episode),
                _upgradeAttempts: upgradeAttempts
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
          }).catch(function(err) {
            if (!isActivePlaySession(session)) return { play: null, fallbacks: [] };
            debug2.debugLog(
              "Primary resolve failed \u2014 escalating: " + (err && err.message ? err.message : String(err))
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
        api.warmStreamUrl(manifestUrl).then(function() {
          playbackSession.setWarmedManifest(manifestUrl);
          debug2.debugLog("Manifest warmed: " + manifestUrl.slice(0, 80));
        }).catch(function() {
        });
      }
      function prefetchMovie(tmdbId) {
        api.resolveMovie(tmdbId, buildPrimaryResolveQuery(), PRIMARY_RESOLVE_TIMEOUT_MS).then(function(play) {
          if (play && api.hasPlayableSources(play)) {
            playbackSession.setPrefetch(playbackSession.prefetchKey("movie", tmdbId), play);
            warmManifestFromPlay(play);
          }
        }).catch(function() {
        });
      }
      function prefetchTvEpisode(tmdbId, season, episode) {
        api.resolveTvEpisode(tmdbId, season, episode, buildPrimaryResolveQuery(), PRIMARY_RESOLVE_TIMEOUT_MS).then(function(play) {
          if (play && api.hasPlayableSources(play)) {
            playbackSession.setPrefetch(
              playbackSession.prefetchKey("tv", tmdbId, season, episode),
              play
            );
            warmManifestFromPlay(play);
          }
        }).catch(function() {
        });
      }
      function playMovie(tmdbId, title, onStatus, meta) {
        meta = meta || {};
        var startSeconds = meta.startSeconds || 0;
        var sessionMeta = {
          tmdbId,
          type: "movie",
          title,
          displayTitle: title,
          showTitle: title
        };
        for (var k in meta) {
          if (Object.prototype.hasOwnProperty.call(meta, k)) sessionMeta[k] = meta[k];
        }
        var session = beginPlaybackRequest(sessionMeta, onStatus);
        return resolvePlayback(tmdbId, "movie", null, null, onStatus, session).then(function(result) {
          if (!isActivePlaySession(session)) return;
          if (!result.play || !api.hasPlayableSources(result.play)) {
            return Promise.reject(new Error(formatResolveError(result.play)));
          }
          return playResolved(result.play, title, onStatus, session, {
            startSeconds,
            _fallbacks: result.fallbacks || [],
            _upgradeAttempts: result._upgradeAttempts || []
          });
        }).catch(function(err) {
          return handlePlaybackFailure(session, err);
        });
      }
      function playTvEpisode(tmdbId, season, episode, title, onStatus, meta) {
        meta = meta || {};
        var startSeconds = meta.startSeconds || 0;
        var sessionMeta = {
          tmdbId,
          type: "tv",
          season,
          episode,
          title,
          displayTitle: title,
          showTitle: meta.showTitle || title,
          episodeTitle: meta.episodeTitle || "",
          overview: meta.overview || "",
          metaLine: meta.metaLine || ""
        };
        for (var k in meta) {
          if (Object.prototype.hasOwnProperty.call(meta, k)) sessionMeta[k] = meta[k];
        }
        var session = beginPlaybackRequest(sessionMeta, onStatus);
        return resolvePlayback(tmdbId, "tv", season, episode, onStatus, session).then(function(result) {
          if (!isActivePlaySession(session)) return;
          if (!result.play || !api.hasPlayableSources(result.play)) {
            return Promise.reject(new Error(formatResolveError(result.play)));
          }
          return playResolved(result.play, title, onStatus, session, {
            startSeconds,
            _fallbacks: result.fallbacks || [],
            _upgradeAttempts: result._upgradeAttempts || []
          });
        }).catch(function(err) {
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
        player2.destroyPlayer(video);
        stored.currentSourceIndex = index;
        var remaining = stored.sources.slice(index);
        function log(msg) {
          debug2.debugLog(msg);
          if (onStatus) onStatus(msg);
        }
        player2.playSources(video, remaining, log, wrap, stored.displayTitle || "Playback");
        return Promise.resolve();
      }
      function reResolveWith(overrides, onStatus) {
        var stored = playbackSession.get();
        if (!stored) return Promise.reject(new Error("No active playback"));
        var query = buildReResolveQuery(overrides);
        if (!query) return Promise.reject(new Error("Nothing to switch"));
        var video = document.getElementById("video");
        if (video) player2.destroyPlayer(video);
        if (onStatus) onStatus("Switching server\u2026");
        debug2.debugLog("Re-resolving: " + query);
        var resolvePromise;
        if (stored.type === "tv") {
          resolvePromise = api.resolveTvEpisode(
            stored.tmdbId,
            stored.season,
            stored.episode,
            query,
            config2.PLAY_RESOLVE_TIMEOUT_MS
          );
        } else {
          resolvePromise = api.resolveMovie(stored.tmdbId, query, config2.PLAY_RESOLVE_TIMEOUT_MS);
        }
        return resolvePromise.then(function(play) {
          if (!play || !api.hasPlayableSources(play)) {
            return Promise.reject(new Error(formatResolveError(play)));
          }
          if (overrides && overrides.providerId) {
            config2.setPreferredProviderId(overrides.providerId);
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
        var wasFullscreen = document.body && document.body.classList.contains("is-playback-fullscreen");
        playerChrome.destroy();
        playbackSession.clear();
        video = document.getElementById("video");
        var wrap = document.getElementById("videoWrap");
        if (video) {
          video._playerChromeBound = false;
          player2.destroyPlayer(video);
          video.removeAttribute("controls");
          video.removeAttribute("crossorigin");
        }
        player2.exitPlaybackMode();
        exitFullscreenPlayback();
        if (wrap) wrap.classList.add("hidden");
        if (wasFullscreen && !options.skipRerender) {
          var router = require_router();
          router.rerenderWithSidebarFocus();
        }
      }
      function getSession() {
        return playbackSession.get();
      }
      module.exports = {
        playResolved,
        playMovie,
        playTvEpisode,
        prefetchMovie,
        prefetchTvEpisode,
        stop,
        getSession,
        switchSource,
        reResolveWith,
        handleBackKey
      };
    }
  });

  // app/js/core/choreography.js
  var require_choreography = __commonJS({
    "app/js/core/choreography.js"(exports, module) {
      var motion = require_motion();
      var focus2 = require_focus();
      var IMMERSIVE_SCREENS = {
        "detail-movie": true,
        "detail-tv": true
      };
      var transitionRunning = false;
      function waitMs(ms) {
        return new Promise(function(resolve) {
          setTimeout(resolve, ms);
        });
      }
      function getScreenEl() {
        return document.getElementById("screen");
      }
      function pulseZoneCross() {
        if (motion.prefersReducedMotion()) return;
        var main = document.getElementById("main");
        if (!main) return;
        main.classList.remove("zone-cross-pulse");
        void main.offsetWidth;
        main.classList.add("zone-cross-pulse");
        var profile = motion.getMotionProfile();
        setTimeout(function() {
          main.classList.remove("zone-cross-pulse");
        }, profile.zonePulseMs + 80);
      }
      function runScreenExit(screenEl) {
        if (!screenEl || motion.prefersReducedMotion()) return Promise.resolve();
        var profile = motion.getMotionProfile();
        screenEl.classList.remove("screen-enter", "screen-enter-active");
        screenEl.classList.add("screen-exit");
        return waitMs(profile.screenExitMs).then(function() {
          screenEl.classList.remove("screen-exit");
        });
      }
      function runScreenEnter(screenEl) {
        if (!screenEl || motion.prefersReducedMotion()) {
          if (screenEl) {
            screenEl.classList.remove("screen-enter", "screen-enter-active", "screen-exit");
          }
          return Promise.resolve();
        }
        var profile = motion.getMotionProfile();
        screenEl.classList.remove("screen-exit");
        screenEl.classList.add("screen-enter");
        return waitMs(16).then(function() {
          screenEl.classList.add("screen-enter-active");
          return waitMs(profile.screenEnterMs);
        }).then(function() {
          screenEl.classList.remove("screen-enter", "screen-enter-active");
        });
      }
      function runScreenTransition(renderFn, options) {
        options = options || {};
        if (transitionRunning) {
          if (renderFn) renderFn();
          return Promise.resolve();
        }
        var screenEl = getScreenEl();
        if (!screenEl || motion.prefersReducedMotion() || options.skipTransition) {
          if (renderFn) renderFn();
          return Promise.resolve();
        }
        transitionRunning = true;
        var isDetail = !!(options.targetScreen && IMMERSIVE_SCREENS[options.targetScreen]);
        if (isDetail) screenEl.classList.add("screen-to-detail");
        return runScreenExit(screenEl).then(function() {
          if (renderFn) renderFn();
          screenEl.classList.remove("screen-to-detail");
          return runScreenEnter(screenEl);
        }).then(function() {
          transitionRunning = false;
        }).catch(function() {
          transitionRunning = false;
        });
      }
      function getCardPosterRect(cardEl) {
        if (!cardEl) return null;
        var poster = cardEl.querySelector(".card-poster");
        var target = poster || cardEl;
        return target.getBoundingClientRect();
      }
      function playDetailHandoff(cardEl) {
        if (!cardEl || motion.prefersReducedMotion()) return Promise.resolve();
        var profile = motion.getMotionProfile();
        var posterUrl = cardEl.getAttribute("data-backdrop") || cardEl.getAttribute("data-poster") || "";
        var rect = getCardPosterRect(cardEl);
        if (!posterUrl || !rect || rect.width < 8) return Promise.resolve();
        var existing = document.getElementById("transition-shell");
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        var shell = document.createElement("div");
        shell.id = "transition-shell";
        shell.className = "transition-shell";
        var poster = document.createElement("div");
        poster.className = "transition-shell-poster";
        poster.style.backgroundImage = "url('" + posterUrl.replace(/'/g, "%27") + "')";
        poster.style.left = Math.round(rect.left) + "px";
        poster.style.top = Math.round(rect.top) + "px";
        poster.style.width = Math.round(rect.width) + "px";
        poster.style.height = Math.round(rect.height) + "px";
        poster.style.webkitTransformOrigin = "center center";
        poster.style.transformOrigin = "center center";
        shell.appendChild(poster);
        document.body.appendChild(shell);
        requestAnimationFrame(function() {
          var vw = window.innerWidth || document.documentElement.clientWidth;
          var vh = window.innerHeight || document.documentElement.clientHeight;
          var scale = Math.max(vw / rect.width, vh / rect.height) * 1.05;
          var dx = vw / 2 - (rect.left + rect.width / 2);
          var dy = vh / 2 - (rect.top + rect.height / 2);
          poster.style.webkitTransform = "translate(" + Math.round(dx) + "px," + Math.round(dy) + "px) scale(" + scale + ")";
          poster.style.transform = "translate(" + Math.round(dx) + "px," + Math.round(dy) + "px) scale(" + scale + ")";
          shell.classList.add("is-expanding");
        });
        return waitMs(profile.handoffMs).then(function() {
          if (shell.parentNode) shell.parentNode.removeChild(shell);
        });
      }
      function openDetail(item, cardEl) {
        if (!item || !item.id) return Promise.resolve();
        var router = require_router();
        var screenName = item.type === "tv" ? "detail-tv" : "detail-movie";
        var params = { tmdbId: item.id, title: item.title || item.name || "" };
        focus2.rememberMainFocus();
        var sourceCard = cardEl;
        if (!sourceCard) {
          var current = focus2.getCurrentElement();
          if (current && current.classList && current.classList.contains("card")) {
            sourceCard = current;
          }
        }
        return playDetailHandoff(sourceCard).then(function() {
          router.navigate(screenName, params);
        });
      }
      function animateDetailContentIn(root) {
        if (!root || motion.prefersReducedMotion()) return;
        var content = root.querySelector(".detail-content");
        if (!content) return;
        content.classList.add("detail-content-enter");
        requestAnimationFrame(function() {
          content.classList.add("detail-content-enter-active");
        });
        var profile = motion.getMotionProfile();
        setTimeout(function() {
          content.classList.remove("detail-content-enter", "detail-content-enter-active");
        }, profile.screenEnterMs + 80);
      }
      function revealDetailEpisodes(sectionEl, onComplete) {
        if (!sectionEl) {
          if (onComplete) onComplete();
          return Promise.resolve();
        }
        if (motion.prefersReducedMotion() || !motion.animationsEnabled()) {
          sectionEl.classList.remove("is-collapsed");
          sectionEl.classList.add("is-revealed");
          focus2.scrollDetailSectionToAnchor(sectionEl);
          if (onComplete) onComplete();
          return Promise.resolve();
        }
        sectionEl.classList.remove("is-collapsed");
        sectionEl.classList.add("is-revealing");
        var profile = motion.getMotionProfile();
        return new Promise(function(resolve) {
          requestAnimationFrame(function() {
            sectionEl.classList.add("is-revealed");
            focus2.scrollDetailSectionToAnchor(sectionEl);
            waitMs(profile.mainScrollMs).then(function() {
              sectionEl.classList.remove("is-revealing");
              if (onComplete) onComplete();
              resolve();
            });
          });
        });
      }
      module.exports = {
        pulseZoneCross,
        runScreenTransition,
        playDetailHandoff,
        openDetail,
        animateDetailContentIn,
        revealDetailEpisodes
      };
    }
  });

  // app/js/core/router.js
  var require_router = __commonJS({
    "app/js/core/router.js"(exports, module) {
      var focus2 = require_focus();
      var playback = require_playback();
      var choreography = require_choreography();
      var stack = [];
      var screens = {};
      var rootEl = null;
      var onFocusHint = null;
      var focusSidebarOnRender = false;
      var isInitialRender = true;
      var BROWSE_SCREENS = {
        home: true,
        trending: true,
        tv: true,
        movies: true,
        search: true
      };
      var IMMERSIVE_SCREENS = {
        "detail-movie": true,
        "detail-tv": true
      };
      function setImmersiveMode(enabled) {
        if (enabled) {
          document.body.classList.add("immersive-detail");
        } else {
          document.body.classList.remove("immersive-detail");
        }
      }
      function updateImmersiveMode() {
        var name = current();
        setImmersiveMode(!!(name && IMMERSIVE_SCREENS[name]));
      }
      function register(name, screen) {
        screens[name] = screen;
      }
      function current() {
        return stack.length ? stack[stack.length - 1] : null;
      }
      function render() {
        if (!rootEl) return Promise.resolve();
        var name = current();
        var screen = name ? screens[name] : null;
        rootEl.innerHTML = "";
        if (screen && typeof screen.render === "function") {
          screen.render(rootEl);
        }
        updateImmersiveMode();
        if (focusSidebarOnRender) {
          focusSidebarOnRender = false;
          focus2.focusSidebar(name || "");
        } else {
          focus2.afterScreenRender(name || "");
        }
        return Promise.resolve();
      }
      function renderWithTransition(options) {
        options = options || {};
        if (!rootEl) return Promise.resolve();
        if (isInitialRender) {
          isInitialRender = false;
          return render();
        }
        return choreography.runScreenTransition(function() {
          var name = current();
          var screen = name ? screens[name] : null;
          rootEl.innerHTML = "";
          if (screen && typeof screen.render === "function") {
            screen.render(rootEl);
          }
          updateImmersiveMode();
        }, options).then(function() {
          if (focusSidebarOnRender) {
            focusSidebarOnRender = false;
            focus2.focusSidebar(current() || "");
          } else {
            focus2.afterScreenRender(current() || "");
          }
        });
      }
      function leaveCurrentScreen() {
        var name = current();
        if (!name) return;
        var screen = screens[name];
        if (screen && typeof screen.onLeave === "function") {
          screen.onLeave();
        }
      }
      function navigate(name, params) {
        var screen = screens[name];
        if (!screen) return Promise.resolve();
        playback.stop({ skipRerender: true });
        stack.push(name);
        if (typeof screen.onEnter === "function") {
          screen.onEnter(params || {});
        }
        return renderWithTransition({ targetScreen: name });
      }
      function replace(name, params) {
        leaveCurrentScreen();
        stack = [];
        return navigate(name, params);
      }
      function canBack() {
        return stack.length > 1;
      }
      function back() {
        if (stack.length <= 1) return Promise.resolve(false);
        playback.stop({ skipRerender: true });
        var leaving = stack.pop();
        var screen = screens[leaving];
        if (screen && typeof screen.onLeave === "function") {
          screen.onLeave();
        }
        return renderWithTransition({ targetScreen: current() }).then(function() {
          var now = current();
          if (BROWSE_SCREENS[now]) {
            focus2.restoreMainFocus();
          }
          return true;
        });
      }
      function rerender() {
        return renderWithTransition({ skipTransition: true });
      }
      function rerenderWithSidebarFocus() {
        focusSidebarOnRender = true;
        return renderWithTransition({ skipTransition: true });
      }
      function init2(options) {
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
        canBack,
        current,
        rerender,
        rerenderWithSidebarFocus,
        init: init2
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
      var lastOskTopRowReturnEl = null;
      var scrollAnimGen = 0;
      var cachedRowAnchorY = null;
      var verticalAnchorTimer = null;
      var resizeHandler = null;
      var resizeTimer = null;
      var detailEpisodesRevealHandler = null;
      var MISALIGN_THRESHOLD_PX = 32;
      function invalidateRowAnchorCache() {
        cachedRowAnchorY = null;
      }
      function cancelVerticalAnchorTimer() {
        if (verticalAnchorTimer) {
          clearTimeout(verticalAnchorTimer);
          verticalAnchorTimer = null;
        }
      }
      function getLayoutSettleMs(options) {
        if (motion.prefersReducedMotion()) return 0;
        var profile = motion.getMotionProfile();
        options = options || {};
        if (options.spotlightToggled || options.browseFocusToggled) {
          return Math.max(profile.opacityMs, profile.transformMs);
        }
        return profile.opacityMs;
      }
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
        if (el.id === "detailEpisodesBtn") return "Episodes";
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
        invalidateRowAnchorCache();
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
          var wasExpanded = document.body.classList.contains("sidebar-expanded");
          if (expanded) document.body.classList.add("sidebar-expanded");
          else document.body.classList.remove("sidebar-expanded");
          if (wasExpanded !== expanded) invalidateRowAnchorCache();
        }
      }
      function isInSpotlightRow(el) {
        if (!el || !el.classList || !el.classList.contains("card")) return false;
        return !!el.closest(".row-spotlight");
      }
      function updateSpotlightMode(el) {
        var wasSpotlight = document.body && document.body.classList.contains("home-spotlight-focus");
        var rows = document.querySelectorAll(".row-spotlight");
        for (var i = 0; i < rows.length; i++) {
          rows[i].classList.remove("is-active");
          var detailPanel = rows[i].querySelector(".row-spotlight-detail");
          if (detailPanel) detailPanel.style.paddingLeft = "";
          var cards = rows[i].querySelectorAll(".card-spotlight");
          for (var c = 0; c < cards.length; c++) {
            if (cards[c] === el) continue;
            var otherPoster = cards[c].querySelector(".card-poster");
            var portraitEl = cards[c].querySelector(".card-poster-portrait");
            var posterUrl = cards[c].getAttribute("data-poster");
            if (portraitEl && posterUrl) {
              portraitEl.style.backgroundImage = "url('" + posterUrl.replace(/'/g, "%27") + "')";
            } else if (otherPoster && posterUrl) {
              otherPoster.style.backgroundImage = "url('" + posterUrl.replace(/'/g, "%27") + "')";
            }
            if (otherPoster) otherPoster.classList.remove("is-backdrop-active");
          }
        }
        if (isInSpotlightRow(el)) {
          document.body.classList.add("home-spotlight-focus");
          var row = el.closest(".row-spotlight");
          if (row) row.classList.add("is-active");
          var posterEl = el.querySelector(".card-poster");
          var backdropLayer = el.querySelector(".card-poster-backdrop");
          var backdropUrl = el.getAttribute("data-backdrop") || el.getAttribute("data-poster");
          if (posterEl && backdropUrl) {
            if (backdropLayer) {
              backdropLayer.style.backgroundImage = "url('" + backdropUrl.replace(/'/g, "%27") + "')";
              posterEl.classList.add("is-backdrop-active");
            } else {
              posterEl.classList.add("is-swapping");
              posterEl.style.backgroundImage = "url('" + backdropUrl.replace(/'/g, "%27") + "')";
              requestAnimationFrame(function() {
                posterEl.classList.remove("is-swapping");
              });
            }
          }
          var spotlightCards = row ? row.querySelectorAll(".card-spotlight") : [];
          for (var s = 0; s < spotlightCards.length; s++) {
            if (spotlightCards[s] === el) continue;
            var otherPoster = spotlightCards[s].querySelector(".card-poster");
            if (otherPoster) otherPoster.classList.remove("is-backdrop-active");
          }
        } else {
          document.body.classList.remove("home-spotlight-focus");
        }
        var isSpotlight = document.body && document.body.classList.contains("home-spotlight-focus");
        if (wasSpotlight !== isSpotlight) invalidateRowAnchorCache();
        return wasSpotlight !== isSpotlight;
      }
      function isStandardBrowseCard(el) {
        if (!el || !el.classList || !el.classList.contains("card")) return false;
        if (isInSidebar(el)) return false;
        if (isInSpotlightRow(el)) return false;
        return !!el.closest(".content-row");
      }
      function updateBrowseFocusMode(el) {
        var wasBrowse = document.body && document.body.classList.contains("home-browse-focus");
        var isBrowse = isStandardBrowseCard(el);
        if (document.body) {
          if (isBrowse) document.body.classList.add("home-browse-focus");
          else document.body.classList.remove("home-browse-focus");
        }
        if (wasBrowse !== isBrowse) invalidateRowAnchorCache();
        return wasBrowse !== isBrowse;
      }
      function isFirstContentRow(el) {
        var main = getMainRoot();
        if (!main || !el) return false;
        var rowEl = el.closest(".content-row");
        if (!rowEl) return false;
        var rows = main.querySelectorAll(".content-row");
        return rows.length > 0 && rows[0] === rowEl;
      }
      function isHomeHeroPreviewVisible() {
        if (document.body && document.body.classList.contains("home-spotlight-focus")) {
          return false;
        }
        var main = getMainRoot();
        if (!main || !main.querySelector(".screen-home")) return false;
        var hero = main.querySelector(".hero");
        return !!(hero && hero.offsetHeight > 0);
      }
      function shouldSkipRowAnchorScroll(el) {
        return isFirstContentRow(el) && isHomeHeroPreviewVisible();
      }
      function clearNeighborDepth() {
        var cards = document.querySelectorAll(".card-is-before, .card-is-after");
        for (var i = 0; i < cards.length; i++) {
          cards[i].classList.remove("card-is-before", "card-is-after");
        }
      }
      function updateNeighborDepth(el) {
        clearNeighborDepth();
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
        if (!motion.animationsEnabled()) {
          setTrackOffset(track, targetOffset);
          if (onComplete) onComplete();
          return;
        }
        scrollAnimGen += 1;
        var gen = scrollAnimGen;
        var profile = motion.getMotionProfile();
        duration = duration || profile.scrollMs;
        if (motion.useCssRowScroll()) {
          let finish2 = function() {
            if (settled || gen !== scrollAnimGen) return;
            settled = true;
            track.removeEventListener("transitionend", onTransitionEnd2);
            track.classList.remove("is-css-scrolling");
            if (onComplete) onComplete();
          }, onTransitionEnd2 = function(e) {
            if (e.target !== track) return;
            if (e.propertyName !== "transform" && e.propertyName !== "-webkit-transform") return;
            finish2();
          };
          var finish = finish2, onTransitionEnd = onTransitionEnd2;
          var settled = false;
          track.classList.add("is-css-scrolling");
          track.addEventListener("transitionend", onTransitionEnd2);
          setTrackOffset(track, targetOffset);
          setTimeout(finish2, duration + 60);
          return;
        }
        track.classList.add("is-animating");
        var startTime = null;
        function step(timestamp) {
          if (gen !== scrollAnimGen) return;
          if (!startTime) startTime = timestamp;
          var elapsed = timestamp - startTime;
          var progress = Math.min(elapsed / duration, 1);
          var eased = motion.easeOutCubic(progress);
          setTrackOffset(track, start + distance * eased);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            track.classList.remove("is-animating");
            if (onComplete) onComplete();
          }
        }
        requestAnimationFrame(step);
      }
      function animateMainScroll(main, targetScroll, duration, options) {
        if (!main) return;
        options = options || {};
        targetScroll = Math.max(0, targetScroll);
        var start = main.scrollTop;
        var distance = targetScroll - start;
        if (Math.abs(distance) < 2) return;
        if (motion.prefersReducedMotion()) {
          main.scrollTop = targetScroll;
          return;
        }
        if (!options.forceAnimate && motion.shouldSnapScroll(distance)) {
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
        var maxOffset = getMaxTrackOffset(track, outer);
        if (!motion.animationsEnabled()) {
          var visibleLeft = cardLeft - scrollLeft;
          var visibleRight = visibleLeft + cardWidth;
          if (visibleLeft < padding) {
            return Math.max(0, cardLeft - padding);
          }
          if (visibleRight > viewWidth - padding) {
            return Math.min(maxOffset, cardLeft + cardWidth - viewWidth + padding);
          }
          return scrollLeft;
        }
        var centerOffset = cardLeft - (viewWidth - cardWidth) / 2;
        centerOffset = Math.max(0, Math.min(centerOffset, maxOffset));
        if (cardLeft <= (viewWidth - cardWidth) / 2) {
          return Math.max(0, Math.min(cardLeft - padding, maxOffset));
        }
        return centerOffset;
      }
      function captureRowAnchorY(el) {
        var main = getMainRoot();
        if (!main || !el) return null;
        var mainRect = main.getBoundingClientRect();
        var rowEl = el.closest(".content-row");
        if (rowEl) {
          var y = getContentRowAnchorTop(rowEl, mainRect);
          return y >= 0 ? y : null;
        }
        if (isHeroFocus(el)) {
          var hero = el.closest(".hero");
          if (hero) {
            var heroRect = hero.getBoundingClientRect();
            return heroRect.bottom - mainRect.top;
          }
        }
        return null;
      }
      function getContentRowAnchorTop(rowEl, mainRect) {
        if (!rowEl) return motion.ROW_ANCHOR_FALLBACK_PX;
        var title = rowEl.querySelector(".row-title");
        var refRect = title ? title.getBoundingClientRect() : rowEl.getBoundingClientRect();
        return refRect.top - mainRect.top;
      }
      function getRowAnchorViewportY(main, rowEl) {
        if (!main) return motion.computeBrowseLaneAnchorY(main);
        if (document.body && document.body.classList.contains("home-spotlight-focus")) {
          return motion.ROW_ANCHOR_SPOTLIGHT_PX;
        }
        if (rowEl) {
          var contentRows = main.querySelectorAll(".content-row");
          for (var i = 0; i < contentRows.length; i++) {
            if (contentRows[i] === rowEl) {
              if (i === 0) {
                return motion.computeBrowseLaneAnchorY(main);
              }
              var mainRect = main.getBoundingClientRect();
              var anchorY = getContentRowAnchorTop(contentRows[i - 1], mainRect);
              if (anchorY >= 0) return anchorY;
            }
          }
        }
        return motion.computeBrowseLaneAnchorY(main);
      }
      function isHeroFocus(el) {
        return !!(el && el.closest(".hero"));
      }
      function isContentRowMisaligned(el) {
        if (!el || !el.classList || !el.classList.contains("card")) return false;
        if (!el.closest(".content-row")) return false;
        if (isInSpotlightRow(el)) return false;
        if (shouldSkipRowAnchorScroll(el)) return false;
        var main = getMainRoot();
        if (!main) return false;
        var rowEl = el.closest(".content-row");
        var mainRect = main.getBoundingClientRect();
        var laneY = isFirstContentRow(el) ? motion.computeBrowseLaneAnchorY(main) : getRowAnchorViewportY(main, rowEl);
        var titleTop = getContentRowAnchorTop(rowEl, mainRect);
        return titleTop > laneY + MISALIGN_THRESHOLD_PX;
      }
      function scrollFocusRowToAnchor(el, anchorYOverride) {
        var main = getMainRoot();
        if (!main || !el) return;
        if (isHeroFocus(el)) {
          animateMainScroll(main, 0, null, { forceAnimate: true });
          return;
        }
        var rowEl = el.closest(".content-row");
        if (!rowEl) {
          scrollIntoView(el);
          return;
        }
        if (shouldSkipRowAnchorScroll(el)) {
          if (main.scrollTop > 2) {
            animateMainScroll(main, 0, null, { forceAnimate: true });
          }
          return;
        }
        var mainRect = main.getBoundingClientRect();
        var title = rowEl.querySelector(".row-title");
        var rowRect = title ? title.getBoundingClientRect() : rowEl.getBoundingClientRect();
        var rowContentTop = rowRect.top - mainRect.top + main.scrollTop;
        var anchorY;
        if (isFirstContentRow(el)) {
          anchorY = motion.computeBrowseLaneAnchorY(main);
        } else if (isInSpotlightRow(el)) {
          anchorY = motion.ROW_ANCHOR_SPOTLIGHT_PX;
        } else if (anchorYOverride != null && anchorYOverride >= 0) {
          anchorY = anchorYOverride;
        } else {
          anchorY = getRowAnchorViewportY(main, rowEl);
        }
        var targetScrollTop = Math.max(0, rowContentTop - anchorY);
        var scrollDistance = Math.abs(targetScrollTop - main.scrollTop);
        if (scrollDistance < 2 && isContentRowMisaligned(el)) {
          main.scrollTop = targetScrollTop;
          return;
        }
        var profile = motion.getMotionProfile();
        animateMainScroll(main, targetScrollTop, profile.mainScrollMs, { forceAnimate: true });
      }
      function scrollDetailSectionToAnchor(sectionEl) {
        var main = getMainRoot();
        if (!main || !sectionEl) return;
        var heading = sectionEl.querySelector(".episode-list-heading") || sectionEl.querySelector(".season-tabs") || sectionEl;
        var mainRect = main.getBoundingClientRect();
        var headingRect = heading.getBoundingClientRect();
        var headingTop = headingRect.top - mainRect.top + main.scrollTop;
        var anchorY = motion.computeBrowseLaneAnchorY(main);
        var targetScrollTop = Math.max(0, headingTop - anchorY);
        var profile = motion.getMotionProfile();
        animateMainScroll(main, targetScrollTop, profile.mainScrollMs, { forceAnimate: true });
      }
      function scrollEpisodeItemToAnchor(el) {
        var main = getMainRoot();
        if (!main || !el) return;
        scrollAnimGen += 1;
        var mainRect = main.getBoundingClientRect();
        var itemRect = el.getBoundingClientRect();
        var itemTop = itemRect.top - mainRect.top + main.scrollTop;
        var anchorY = motion.computeBrowseLaneAnchorY(main);
        main.scrollTop = Math.max(0, itemTop - anchorY);
      }
      function setDetailEpisodesRevealHandler(fn) {
        detailEpisodesRevealHandler = fn || null;
      }
      function scheduleVerticalAnchor(el, options) {
        options = options || {};
        cancelVerticalAnchorTimer();
        scrollAnimGen += 1;
        var gen = scrollAnimGen;
        var delay = isEpisodeItem(el) ? 0 : getLayoutSettleMs(options);
        var capturedAnchorY = options.capturedAnchorY;
        if (options.spotlightToggled || options.browseFocusToggled) {
          capturedAnchorY = null;
        }
        function measureAndScroll() {
          verticalAnchorTimer = null;
          if (gen !== scrollAnimGen || currentEl !== el) return;
          if (isEpisodeItem(el)) {
            scrollEpisodeItemToAnchor(el);
            return;
          }
          requestAnimationFrame(function() {
            if (gen !== scrollAnimGen || currentEl !== el) return;
            requestAnimationFrame(function() {
              if (gen !== scrollAnimGen || currentEl !== el) return;
              var detailSection = el.closest(".detail-episodes-section");
              if (detailSection) {
                if (isEpisodeItem(el)) {
                  scrollEpisodeItemToAnchor(el);
                } else {
                  scrollDetailSectionToAnchor(detailSection);
                }
              } else {
                scrollFocusRowToAnchor(el, capturedAnchorY);
              }
              scheduleSpotlightLayoutSync(el);
            });
          });
        }
        if (delay > 0) {
          verticalAnchorTimer = setTimeout(measureAndScroll, delay);
        } else {
          measureAndScroll();
        }
      }
      function getSpotlightScrollPadding(el) {
        if (indexInRow(el) === 0) return 0;
        var scrollEls = getScrollElements(el);
        var outer = scrollEls.outer;
        if (!outer) return 40;
        var viewWidth = outer.clientWidth;
        var cardWidth = el.offsetWidth || 130;
        return Math.max(40, Math.round((viewWidth - cardWidth) * 0.18));
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
        target = getHorizontalScrollTarget(track, outer, el, padding);
        animateTrackOffset(track, outer, target, duration, onComplete);
      }
      function syncSpotlightLayout(el) {
        if (!isInSpotlightRow(el)) return;
        var row = el.closest(".row-spotlight");
        if (row && typeof row._syncSpotlightLayout === "function") {
          row._syncSpotlightLayout();
        }
      }
      function scheduleSpotlightLayoutSync(el) {
        if (!el || !isInSpotlightRow(el)) return;
        requestAnimationFrame(function() {
          if (currentEl !== el) return;
          requestAnimationFrame(function() {
            if (currentEl !== el) return;
            syncSpotlightLayout(el);
          });
        });
      }
      function scheduleScrollAfterLayout(el, rowId, needsVerticalAnchor, scrollOptions) {
        scrollOptions = scrollOptions || {};
        scrollAnimGen += 1;
        var gen = scrollAnimGen;
        var isSpotlight = isInSpotlightRow(el);
        function afterHorizontalScroll() {
          if (gen !== scrollAnimGen || currentEl !== el) return;
          if (isSpotlight) scheduleSpotlightLayoutSync(el);
        }
        function runScroll() {
          if (gen !== scrollAnimGen || currentEl !== el) return;
          if (el.classList.contains("card")) {
            scrollRowIntoView(el, afterHorizontalScroll);
          } else if (afterHorizontalScroll) {
            afterHorizontalScroll();
          }
          if (needsVerticalAnchor) {
            if (el.closest(".content-row") || isHeroFocus(el) || el.closest(".detail-episodes-section")) {
              scheduleVerticalAnchor(el, scrollOptions);
            } else {
              scrollIntoView(el);
            }
          }
        }
        requestAnimationFrame(runScroll);
      }
      function focusElement(el) {
        if (!el) return false;
        var previousEl = currentEl;
        var previousRowId = lastFocusRowId;
        var rowId = getFocusRowId(el);
        var rowChanged = rowId !== previousRowId;
        var capturedAnchorY = rowChanged && previousEl ? captureRowAnchorY(previousEl) : null;
        clearAllFocus();
        currentEl = el;
        el.classList.add("tv-focus");
        lastFocusRowId = rowId;
        setSidebarExpanded(isInSidebar(el));
        var spotlightToggled = updateSpotlightMode(el);
        var browseFocusToggled = updateBrowseFocusMode(el);
        updateNeighborDepth(el);
        var skipRowAnchor = shouldSkipRowAnchorScroll(el);
        var needsVerticalAnchor = !skipRowAnchor && (rowChanged || spotlightToggled || browseFocusToggled || isContentRowMisaligned(el) || isEpisodeItem(el));
        if (skipRowAnchor && rowChanged) {
          var mainRoot = getMainRoot();
          if (mainRoot && mainRoot.scrollTop > 2) {
            needsVerticalAnchor = true;
          }
        }
        scheduleScrollAfterLayout(el, rowId, needsVerticalAnchor, {
          capturedAnchorY,
          spotlightToggled,
          browseFocusToggled
        });
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
      function isHeroNavigable() {
        if (document.body && document.body.classList.contains("home-spotlight-focus")) {
          return false;
        }
        var hero = document.querySelector(".hero");
        if (!hero || hero.offsetHeight === 0) return false;
        var actions = hero.querySelector('[data-focus-row="hero"]');
        if (!actions) return false;
        return getFocusables(actions).length > 0;
      }
      function getOrderedRowIds() {
        var main = getMainRoot();
        if (!main) return [];
        var nodes = main.querySelectorAll("[data-focus-row]");
        var ids = [];
        for (var i = 0; i < nodes.length; i++) {
          var id = nodes[i].getAttribute("data-focus-row");
          if (!id || ids.indexOf(id) !== -1) continue;
          if (id === "hero" && !isHeroNavigable()) continue;
          ids.push(id);
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
      function isSearchResultsRow(rowId) {
        return !!(rowId && rowId.indexOf("search-results-") === 0);
      }
      function isEpisodeItem(el) {
        return !!(el && el.classList && el.classList.contains("episode-item"));
      }
      function getEpisodeSiblings(el) {
        var list = el && el.closest ? el.closest(".episode-list-items") : null;
        return list ? getFocusables(list) : [];
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
        if (isEpisodeItem(el)) return el;
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
        if (isEpisodeItem(el)) return el;
        var items = getRowFocusables(getFocusRowId(el));
        var idx = indexInRow(el);
        if (idx < items.length - 1) return items[idx + 1];
        var crossRight = el.getAttribute("data-cross-right");
        if (crossRight) {
          if (el.classList.contains("osk-key") || el.classList.contains("search-suggestion")) {
            lastSearchLeftEl = el;
          }
          var targetCol = isSearchResultsRow(crossRight) ? 0 : idx;
          var target = getCrossTargetRow(crossRight, targetCol);
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
      function resolveCrossCol(colAttr, fallbackCol, itemsLength) {
        if (colAttr === "last") return itemsLength - 1;
        if (colAttr != null && colAttr !== "") {
          var parsed = parseInt(colAttr, 10);
          if (!isNaN(parsed)) return parsed;
        }
        return fallbackCol;
      }
      function handleMainVertical(el, dir) {
        if (isEpisodeItem(el)) {
          var episodeItems = getEpisodeSiblings(el);
          var episodeIdx = episodeItems.indexOf(el);
          if (episodeIdx !== -1) {
            if (dir === "down" && episodeIdx < episodeItems.length - 1) {
              return episodeItems[episodeIdx + 1];
            }
            if (dir === "up" && episodeIdx > 0) {
              return episodeItems[episodeIdx - 1];
            }
          }
        }
        var rowId = getFocusRowId(el);
        if (!rowId) return handleMainVerticalLinear(el, dir);
        if (dir === "down" && rowId === "osk-0") {
          if (lastOskTopRowReturnEl && document.body.contains(lastOskTopRowReturnEl) && getFocusRowId(lastOskTopRowReturnEl) === "osk-1") {
            return lastOskTopRowReturnEl;
          }
        }
        if (dir === "up" && el.getAttribute("data-cross-up") === "osk-0") {
          lastOskTopRowReturnEl = el;
        }
        var crossAttr = dir === "down" ? "data-cross-down" : "data-cross-up";
        var crossRow = el.getAttribute(crossAttr);
        if (crossRow) {
          var colAttr = el.getAttribute(crossAttr + "-col");
          var targetItems = getRowFocusables(crossRow);
          if (targetItems.length) {
            var crossCol = resolveCrossCol(colAttr, indexInRow(el), targetItems.length);
            return targetItems[Math.min(crossCol, targetItems.length - 1)];
          }
        }
        var rows = getOrderedRowIds();
        var rowIdx = rows.indexOf(rowId);
        if (rowIdx === -1) return el;
        var col = indexInRow(el);
        var step = dir === "up" ? -1 : 1;
        var targetIdx = rowIdx + step;
        while (targetIdx >= 0 && targetIdx < rows.length) {
          var targetItems = getRowFocusables(rows[targetIdx]);
          if (targetItems.length) {
            return targetItems[Math.min(col, targetItems.length - 1)];
          }
          targetIdx += step;
        }
        return el;
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
      function isInMainArea(el) {
        if (!el) el = currentEl;
        if (!el) return true;
        return !isInSidebar(el);
      }
      function focusSidebar(screenName) {
        setSidebarExpanded(true);
        var sidebar = document.getElementById("sidebar");
        if (!sidebar) return false;
        var el = null;
        if (screenName) {
          el = sidebar.querySelector('.nav-item[data-screen="' + screenName + '"]');
        }
        if (!el && lastSidebarEl && sidebar.contains(lastSidebarEl)) {
          el = lastSidebarEl;
        }
        if (!el) {
          var active = sidebar.querySelector(".nav-item.active");
          if (active) el = active;
        }
        if (!el) {
          var nav = getSidebarFocusables();
          el = nav.length ? nav[0] : null;
        }
        return el ? focusElement(el) : false;
      }
      function handleBrowseBack() {
        if (isInSidebar(currentEl)) return false;
        var router = require_router();
        return focusSidebar(router.current());
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
            try {
              require_choreography().pulseZoneCross();
            } catch (err) {
            }
            focusDefaultMain();
            e.preventDefault();
            return;
          }
        } else {
          if (isDown && currentEl.id === "detailEpisodesBtn" && detailEpisodesRevealHandler) {
            var collapsedSection = document.querySelector(".detail-episodes-section.is-collapsed");
            if (collapsedSection || !document.querySelector(".detail-episodes-section.is-revealed")) {
              detailEpisodesRevealHandler();
              e.preventDefault();
              return;
            }
          }
          if (isLeft) next = handleMainLeft(currentEl);
          else if (isRight) next = handleMainRight(currentEl);
          else if (isUp) next = handleMainVertical(currentEl, "up");
          else if (isDown) next = handleMainVertical(currentEl, "down");
        }
        if (next && next !== currentEl) {
          var wasSidebar = inSidebar;
          var willSidebar = isInSidebar(next);
          if (wasSidebar !== willSidebar && !wasSidebar && willSidebar) {
            try {
              require_choreography().pulseZoneCross();
            } catch (err) {
            }
          }
          focusElement(next);
        }
        if (isLeft || isRight || isUp || isDown) e.preventDefault();
      }
      function handleWindowResize() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
          resizeTimer = null;
          invalidateRowAnchorCache();
          var el = currentEl;
          if (!el || isInSidebar(el)) return;
          if (!el.classList.contains("card")) return;
          if (!el.closest(".content-row")) return;
          scrollFocusRowToAnchor(el, null);
          scheduleSpotlightLayoutSync(el);
        }, 150);
      }
      function init2(cb) {
        if (keyHandler) {
          document.removeEventListener("keydown", keyHandler);
        }
        if (resizeHandler) {
          window.removeEventListener("resize", resizeHandler);
        }
        onFocusChange = cb || null;
        keyHandler = onKeyDown;
        document.addEventListener("keydown", keyHandler);
        resizeHandler = handleWindowResize;
        if (typeof window !== "undefined") {
          window.addEventListener("resize", resizeHandler);
        }
      }
      function destroy() {
        cancelVerticalAnchorTimer();
        if (resizeTimer) {
          clearTimeout(resizeTimer);
          resizeTimer = null;
        }
        if (resizeHandler && typeof window !== "undefined") {
          window.removeEventListener("resize", resizeHandler);
          resizeHandler = null;
        }
        if (keyHandler) {
          document.removeEventListener("keydown", keyHandler);
          keyHandler = null;
        }
        clearAllFocus();
        clearNeighborDepth();
        currentEl = null;
        lastFocusRowId = null;
        setSidebarExpanded(false);
        document.body.classList.remove("home-spotlight-focus");
        document.body.classList.remove("home-browse-focus");
      }
      function getCurrentElement() {
        return currentEl;
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
        focusSidebar,
        handleBrowseBack,
        isInMainArea,
        resetMainScroll,
        afterScreenRender,
        scrollDetailSectionToAnchor,
        setDetailEpisodesRevealHandler,
        getFocusables,
        getCurrentElement,
        setupFocus
      };
    }
  });

  // app/js/gate/main.js
  var config = require_config();
  var player = require_player();
  var focus = require_focus();
  var debug = require_debug();
  var keys = require_keys();
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
      if (keys.isBackKey(e)) {
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
