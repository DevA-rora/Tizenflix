var STORAGE_KEY = "tizenflix.apiBase";
var QUALITY_MODE_KEY = "tizenflix.qualityMode";
var DEFAULT_API = "http://192.168.86.11:8790";
var PLAY_RESOLVE_TIMEOUT_MS = 90000;
var VALID_QUALITY_MODES = ["auto", "high", "medium", "low"];

function getApiBase() {
  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.indexOf("localhost") === -1 && stored.indexOf("127.0.0.1") === -1) {
      return stored;
    }
  } catch (err) {
    /* TV may block storage */
  }
  return DEFAULT_API;
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

function resolvePlay(apiBase, path, query) {
  var url = apiBase + path;
  if (query) {
    url += (url.indexOf("?") === -1 ? "?" : "&") + query;
  }
  return fetchWithTimeout(url, PLAY_RESOLVE_TIMEOUT_MS).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (text) {
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
  var path =
    "/play/tv/" +
    encodeURIComponent(tmdbId) +
    "/" +
    encodeURIComponent(season) +
    "/" +
    encodeURIComponent(episode);
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

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  QUALITY_MODE_KEY: QUALITY_MODE_KEY,
  PLAY_RESOLVE_TIMEOUT_MS: PLAY_RESOLVE_TIMEOUT_MS,
  DEFAULT_API: DEFAULT_API,
  VALID_QUALITY_MODES: VALID_QUALITY_MODES,
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
};
