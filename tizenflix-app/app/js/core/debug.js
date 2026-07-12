var MAX_LINES = 8;
var lines = [];

var READY_LABELS = {
  0: "nothing",
  1: "metadata",
  2: "current",
  3: "future",
  4: "enough",
};

var NETWORK_LABELS = {
  0: "empty",
  1: "idle",
  2: "loading",
  3: "no_source",
};

function render() {
  var el = document.getElementById("debugOverlay");
  if (!el) return;
  el.textContent = lines.join("\n");
  el.classList.remove("hidden");
}

function debugLog(msg) {
  var time = new Date().toLocaleTimeString();
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
    4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
  };
  return (codes[e.code] || "code " + e.code) + (e.message ? ": " + e.message : "");
}

function formatVideoState(video) {
  if (!video) return "no video";
  var rs = video.readyState;
  var ns = video.networkState;
  return (
    "rs=" +
    rs +
    "(" +
    (READY_LABELS[rs] || "?") +
    ") ns=" +
    ns +
    "(" +
    (NETWORK_LABELS[ns] || "?") +
    ") paused=" +
    video.paused
  );
}

function attachVideoDebug(video, onLog) {
  if (!video) return;

  function logState(eventName) {
    var msg = eventName + " " + formatVideoState(video);
    debugLog(msg);
    if (onLog) onLog(msg);
  }

  video.addEventListener("loadstart", function () {
    logState("loadstart");
  });
  video.addEventListener("loadedmetadata", function () {
    logState("loadedmetadata");
  });
  video.addEventListener("canplay", function () {
    logState("canplay");
  });
  video.addEventListener("loadeddata", function () {
    logState("loadeddata");
  });
  video.addEventListener("playing", function () {
    debugLog("playing t=" + Math.floor(video.currentTime) + "s " + formatVideoState(video));
  });
  video.addEventListener("waiting", function () {
    debugLog("buffering... " + formatVideoState(video));
  });
  video.addEventListener("error", function () {
    var msg = "video error — " + describeVideoError(video) + " " + formatVideoState(video);
    debugLog(msg);
    if (onLog) onLog(msg);
  });
}

module.exports = {
  debugLog: debugLog,
  debugClear: debugClear,
  describeVideoError: describeVideoError,
  formatVideoState: formatVideoState,
  attachVideoDebug: attachVideoDebug,
};
