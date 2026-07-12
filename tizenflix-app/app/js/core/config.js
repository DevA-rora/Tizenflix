var STORAGE_KEY = "tizenflix.apiBase";
var QUALITY_MODE_KEY = "tizenflix.qualityMode";
var DEV_MODE_KEY = "tizenflix.devMode";
var BACKEND_KEY = "tizenflix.playBackend";
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
  if (backend) parts.push("backend=" + backend);
  if (extra) parts.push(extra);
  return parts.length ? parts.join("&") : null;
}

function getPlayBackend() {
  try {
    var stored = localStorage.getItem(BACKEND_KEY);
    if (stored === "vidking" || stored === "streamflix" || stored === "auto" || stored === "tmdb-native") return stored;
  } catch (err) {
    /* TV may block storage */
  }
  return "auto";
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

function fetchWithTimeout(url, ms) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      reject(new Error("Request timed out after " + ms + "ms"));
    }, ms);

    fetch(url)
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
  return "auto";
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

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  QUALITY_MODE_KEY: QUALITY_MODE_KEY,
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
  getApiBase: getApiBase,
  setApiBase: setApiBase,
  getQualityMode: getQualityMode,
  setQualityMode: setQualityMode,
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
  fetchWithTimeout: fetchWithTimeout,
};
