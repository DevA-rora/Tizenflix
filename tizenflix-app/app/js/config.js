var STORAGE_KEY = "tizenflix.apiBase";
var DEFAULT_API = "http://192.168.86.11:8790";

function getApiBase() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_API;
  } catch (err) {
    return DEFAULT_API;
  }
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

function resolveMovie(apiBase, tmdbId) {
  return fetchWithTimeout(apiBase + "/play/movie/" + tmdbId, 30000).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (text) {
        throw new Error("Play API " + res.status + (text ? ": " + text.slice(0, 120) : ""));
      });
    }
    return res.json();
  });
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
  DEFAULT_API: DEFAULT_API,
  getApiBase: getApiBase,
  setApiBase: setApiBase,
  checkHealth: checkHealth,
  resolveMovie: resolveMovie,
  pickPlayableSource: pickPlayableSource,
  detectStreamType: detectStreamType,
  logLine: logLine,
};
