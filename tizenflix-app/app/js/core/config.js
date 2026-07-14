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
var PLAY_RESOLVE_TIMEOUT_MS = 90000;
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
    /* TV may block storage */
  }
  return true;
}

function setDevMode(enabled) {
  try {
    localStorage.setItem(DEV_MODE_KEY, enabled ? "1" : "0");
  } catch (err) {
    /* TV may block storage */
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
    /* TV may block storage */
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
    /* TV may block storage */
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

  return sources.slice().sort(function (a, b) {
    var ha = parseHeightFromLabel(a.label);
    var hb = parseHeightFromLabel(b.label);
    function score(h) {
      if (!h) return -1;
      if (h === targetPx) return 10000 + h;
      if (h < targetPx) return 5000 + h;
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
  if (height === targetPx) return 10000 + height;
  if (height < targetPx) return 5000 + height;
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
    /* TV may block storage */
  }
  return "streamflix";
}

function setPlayBackend(mode) {
  var m =
    mode === "streamflix" || mode === "auto" || mode === "tmdb-native" ? mode : "vidking";
  try {
    localStorage.setItem(BACKEND_KEY, m);
  } catch (err) {
    /* TV may block storage */
  }
  return m;
}

function getPreferredSourceId() {
  try {
    var stored = localStorage.getItem(PREFERRED_SOURCE_KEY);
    if (stored && typeof stored === "string") return stored;
  } catch (err) {
    /* TV may block storage */
  }
  return null;
}

function setPreferredSourceId(sourceId) {
  try {
    if (!sourceId) localStorage.removeItem(PREFERRED_SOURCE_KEY);
    else localStorage.setItem(PREFERRED_SOURCE_KEY, String(sourceId));
  } catch (err) {
    /* TV may block storage */
  }
  return sourceId || null;
}

function getPreferredProviderId() {
  try {
    var stored = localStorage.getItem(PREFERRED_PROVIDER_KEY);
    if (stored && typeof stored === "string") return stored;
  } catch (err) {
    /* TV may block storage */
  }
  return null;
}

function setPreferredProviderId(providerId) {
  try {
    if (!providerId) localStorage.removeItem(PREFERRED_PROVIDER_KEY);
    else localStorage.setItem(PREFERRED_PROVIDER_KEY, String(providerId));
  } catch (err) {
    /* TV may block storage */
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
    /* TV may block storage */
  }
  return deriveDefaultApi();
}

function setApiBase(url) {
  var trimmed = (url || "").replace(/\/$/, "");
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch (err) {
    /* TV may block storage */
  }
  return trimmed;
}

function fetchWithTimeout(url, ms, init) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      reject(new Error("Request timed out after " + ms + "ms"));
    }, ms);

    fetch(url, init)
      .then(function (res) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(res);
      })
      .catch(function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      });
  });
}

function checkHealth(apiBase) {
  return fetchWithTimeout(apiBase + "/health", 8000).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function getQualityMode() {
  try {
    var stored = localStorage.getItem(QUALITY_MODE_KEY);
    if (stored && VALID_QUALITY_MODES.indexOf(stored) !== -1) return stored;
  } catch (err) {
    /* TV may block storage */
  }
  return "high";
}

function setQualityMode(mode) {
  var m = VALID_QUALITY_MODES.indexOf(mode) !== -1 ? mode : "auto";
  try {
    localStorage.setItem(QUALITY_MODE_KEY, m);
  } catch (err) {
    /* TV may block storage */
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
    /* TV may block storage */
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
    /* TV may block storage */
  }
}

function levelHeightsFromHls(hls) {
  var out = [];
  if (!hls || !hls.levels) return out;
  for (var i = 0; i < hls.levels.length; i++) {
    out.push({
      index: i,
      height: hls.levels[i].height || 0,
      bitrate: hls.levels[i].bitrate || 0,
    });
  }
  return out;
}

/** Pick HLS level index for a target pixel height (0 = auto). */
function levelIndexForTargetHeight(hls, targetPixels) {
  var indexed = levelHeightsFromHls(hls);
  if (!indexed.length) return -1;
  indexed.sort(function (a, b) {
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

/** Pick HLS level index by target height (high = best up to 1080p). */
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
    /* TV may block storage */
  }
  return { mode: "auto", level: -1 };
}

function setQualityLevel(index) {
  var level = typeof index === "number" && isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  writeQualityLevelPref({ mode: "manual", level: level });
  try {
    localStorage.removeItem(QUALITY_MODE_KEY);
  } catch (err) {
    /* TV may block storage */
  }
  return { mode: "manual", level: level };
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
    /* TV may block storage */
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
    /* */
  }
  return true;
}

function setAutoplayNext(enabled) {
  try {
    localStorage.setItem(AUTOPLAY_KEY, enabled ? "1" : "0");
  } catch (err) {
    /* */
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
    /* TV may block storage */
  }
  return isTizenClient();
}

function setExtraBuffering(enabled) {
  try {
    localStorage.setItem(EXTRA_BUFFER_KEY, enabled ? "1" : "0");
  } catch (err) {
    /* */
  }
  return !!enabled;
}

function getPlaybackSpeed() {
  var speeds = [0.75, 1, 1.25, 1.5, 2];
  var stored = "1";
  try {
    stored = localStorage.getItem(PLAYBACK_SPEED_KEY) || "1";
  } catch (err) {
    /* */
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
    /* */
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
    /* */
  }
  return "en";
}

function setCatalogLang(lang) {
  var code = (lang || "en").toLowerCase().split("-")[0];
  try {
    localStorage.setItem(CATALOG_LANG_KEY, code);
  } catch (err) {
    /* */
  }
  return code;
}

function getAudioPref() {
  try {
    var stored = localStorage.getItem(AUDIO_PREF_KEY);
    if (stored && VALID_AUDIO_PREFS.indexOf(stored) !== -1) return stored;
  } catch (err) {
    /* */
  }
  return "original";
}

function setAudioPref(pref) {
  var value = VALID_AUDIO_PREFS.indexOf(pref) !== -1 ? pref : "original";
  try {
    localStorage.setItem(AUDIO_PREF_KEY, value);
  } catch (err) {
    /* */
  }
  return value;
}

function getUiAnimations() {
  try {
    var stored = localStorage.getItem(ANIMATIONS_KEY);
    if (stored === "0" || stored === "false") return false;
    if (stored === "1" || stored === "true") return true;
  } catch (err) {
    /* */
  }
  return true;
}

function setUiAnimations(enabled) {
  try {
    localStorage.setItem(ANIMATIONS_KEY, enabled ? "1" : "0");
  } catch (err) {
    /* */
  }
  return !!enabled;
}

function resolvePlay(apiBase, path, query, timeoutMs) {
  var url = apiBase + path;
  if (query) {
    url += (url.indexOf("?") === -1 ? "?" : "&") + query;
  }
  var ms = timeoutMs || PLAY_RESOLVE_TIMEOUT_MS;
  return fetchWithTimeout(url, ms).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (text) {
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
  var path =
    "/play/tv/" +
    encodeURIComponent(tmdbId) +
    "/" +
    encodeURIComponent(season) +
    "/" +
    encodeURIComponent(episode);
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
    ordered = ordered.filter(function (source) {
      return source.type === "m3u8";
    });
  }
  if (!play || !play.warnings || !play.warnings.length) return ordered;

  return ordered.filter(function (source) {
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
  var time = new Date().toLocaleTimeString();
  el.textContent = "[" + time + "] " + message;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function apiGet(path) {
  return fetchWithTimeout(getApiBase() + path, 20000).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (text) {
        throw new Error("API " + res.status + (text ? ": " + text.slice(0, 120) : ""));
      });
    }
    return res.json();
  });
}

function apiPost(path, body) {
  return fetchWithTimeout(
    getApiBase() + path,
    20000,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }
  ).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (text) {
        throw new Error("API " + res.status + (text ? ": " + text.slice(0, 120) : ""));
      });
    }
    return res.json();
  });
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  QUALITY_MODE_KEY: QUALITY_MODE_KEY,
  QUALITY_LEVEL_KEY: QUALITY_LEVEL_KEY,
  DEV_MODE_KEY: DEV_MODE_KEY,
  PLAY_RESOLVE_TIMEOUT_MS: PLAY_RESOLVE_TIMEOUT_MS,
  deriveDefaultApi: deriveDefaultApi,
  API_PORT: API_PORT,
  VALID_QUALITY_MODES: VALID_QUALITY_MODES,
  isTizenClient: isTizenClient,
  getDevMode: getDevMode,
  setDevMode: setDevMode,
  buildPlayQuery: buildPlayQuery,
  getPlayBackend: getPlayBackend,
  setPlayBackend: setPlayBackend,
  getPreferredSourceId: getPreferredSourceId,
  setPreferredSourceId: setPreferredSourceId,
  getPreferredProviderId: getPreferredProviderId,
  setPreferredProviderId: setPreferredProviderId,
  getApiBase: getApiBase,
  setApiBase: setApiBase,
  getQualityMode: getQualityMode,
  setQualityMode: setQualityMode,
  getQualityPreference: getQualityPreference,
  setQualityAuto: setQualityAuto,
  setQualityLevel: setQualityLevel,
  resolveLegacyQualityLevel: resolveLegacyQualityLevel,
  levelIndexForLegacyMode: levelIndexForLegacyMode,
  levelIndexForTargetHeight: levelIndexForTargetHeight,
  getTargetResolution: getTargetResolution,
  setTargetResolution: setTargetResolution,
  targetResolutionPixels: targetResolutionPixels,
  preferredQualityForTarget: preferredQualityForTarget,
  parseHeightFromLabel: parseHeightFromLabel,
  orderSourcesForTargetResolution: orderSourcesForTargetResolution,
  maxSourceHeight: maxSourceHeight,
  qualityHeightScore: qualityHeightScore,
  isBelowTargetResolution: isBelowTargetResolution,
  VALID_TARGET_RESOLUTIONS: VALID_TARGET_RESOLUTIONS,
  checkHealth: checkHealth,
  resolveMovie: resolveMovie,
  resolveTvEpisode: resolveTvEpisode,
  pickPlayableSource: pickPlayableSource,
  listM3u8Sources: listM3u8Sources,
  orderSourcesForPlay: orderSourcesForPlay,
  listSourcesToTry: listSourcesToTry,
  detectStreamType: detectStreamType,
  logLine: logLine,
  apiGet: apiGet,
  apiPost: apiPost,
  fetchWithTimeout: fetchWithTimeout,
  GRID_SCALE_KEY: GRID_SCALE_KEY,
  getGridScale: getGridScale,
  setGridScale: setGridScale,
  applyGridScale: applyGridScale,
  getAutoplayNext: getAutoplayNext,
  setAutoplayNext: setAutoplayNext,
  getAutoplayBufferSec: getAutoplayBufferSec,
  setAutoplayBufferSec: setAutoplayBufferSec,
  getExtraBuffering: getExtraBuffering,
  setExtraBuffering: setExtraBuffering,
  getPlaybackSpeed: getPlaybackSpeed,
  setPlaybackSpeed: setPlaybackSpeed,
  cyclePlaybackSpeed: cyclePlaybackSpeed,
  getCatalogLang: getCatalogLang,
  setCatalogLang: setCatalogLang,
  CATALOG_LANG_KEY: CATALOG_LANG_KEY,
  AUDIO_PREF_KEY: AUDIO_PREF_KEY,
  VALID_AUDIO_PREFS: VALID_AUDIO_PREFS,
  getAudioPref: getAudioPref,
  setAudioPref: setAudioPref,
  getUiAnimations: getUiAnimations,
  setUiAnimations: setUiAnimations,
};
