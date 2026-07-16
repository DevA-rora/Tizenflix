var config = require("../core/config.js");
var debug = require("../core/debug.js");

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
  btn.addEventListener("click", function () {
    cycleSubtitles(video);
  });
}

var READY_TIMEOUT_MS = 5000;
var HLS_PRIME_BUFFER_SEC = 4;
var HLS_PRIME_TIMEOUT_MS = 3000;
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
      /* ignore */
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
      /* ignore */
    }
    try {
      hlsInstance.detachMedia();
    } catch (e) {
      /* ignore */
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

/** Show fullscreen chrome while resolving or buffering (before the playing event). */
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
      result.catch(function (e) {
        var msg = "Autoplay blocked: " + e.message;
        debug.debugLog(msg);
        if (onError) onError(msg);
      });
    }
  } catch (e) {
    var msg = "play() threw: " + e.message;
    debug.debugLog(msg);
    if (onError) onError(msg);
  }
}

function prepareVideoElement(video, videoWrap) {
  video.removeAttribute("controls");
  showVideoWrap(videoWrap);
}

function setupPlayingListener(video, title) {
  var onPlaying = function () {
    video.removeEventListener("playing", onPlaying);
    enterPlaybackMode(title);
    debug.debugLog("Entered fullscreen on playing");
  };
  video.addEventListener("playing", onPlaying);
  trackCleanup(function () {
    video.removeEventListener("playing", onPlaying);
  });
}

function whenCanPlay(video, callback, timeoutMs, onTimeout, session) {
  if (video.readyState >= 2) {
    callback();
    return function () {};
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

  var timer = setTimeout(function () {
    if (called || !isActiveSession(session)) return;
    called = true;
    video.removeEventListener("loadedmetadata", onReady);
    video.removeEventListener("canplay", onReady);
    if (onTimeout) onTimeout();
  }, timeoutMs || READY_TIMEOUT_MS);

  return trackCleanup(function () {
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
    debug.debugLog("Resumed at " + Math.floor(target) + "s");
  } catch (err) {
    debug.debugLog("Resume seek failed: " + err.message);
  }
  resumeAtSeconds = null;
}

function setResumePosition(seconds) {
  resumeAtSeconds = seconds > 0 ? seconds : null;
}

function hintResumeIfPaused(video, onLog) {
  setTimeout(function () {
    if (video.paused && video.readyState >= 2) {
      var msg = "Loaded — press Play on remote or tap Resume";
      debug.debugLog(msg);
      if (onLog) onLog(msg);
    }
  }, 500);
}

function attemptPlay(video, onLog) {
  logVideoState(video, "before safePlay()");
  safePlay(video, function (msg) {
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
    function () {
      if (!isActiveSession(session)) return;
      logVideoState(video, "canplay ready");
      applyResumePosition(video);
      attemptPlay(video, onLog);
    },
    options.timeoutMs || READY_TIMEOUT_MS,
    function () {
      if (!isActiveSession(session)) return;
      logVideoState(video, "stall timeout");
      if (options.onStall) {
        options.onStall();
      } else {
        var msg = "Playback stall — readyState never reached 2";
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
  return (
    !!url &&
    (url.indexOf("/proxy/stream") !== -1 || url.indexOf("/proxy/inline-manifest") !== -1)
  );
}

function prefersHlsJsFirst(url) {
  // Every Tizenflix stream is served through our own proxy. hls.js is the path
  // proven to work in desktop browsers and is far more tolerant of manifest
  // quirks than Tizen's native AVPlay — which previously stalled on proxied HLS
  // and forced the TMDB-native backup fallback. Prefer hls.js first for any
  // proxied/inline HLS, including on Tizen.
  if (isProxiedHls(url)) return true;
  if (prefersNativeHls()) {
    var pref = config.getQualityPreference();
    if (pref.mode === "manual") return true;
    return false;
  }
  return false;
}

function createHlsInstance() {
  var extra = config.getExtraBuffering();
  var baseMax = extra ? 120 : isTizenTv() ? 90 : 60;
  return new Hls({
    enableWorker: false,
    maxBufferLength: baseMax,
    maxMaxBufferLength: extra ? 300 : isTizenTv() ? 240 : 180,
    maxBufferSize: 120 * 1000 * 1000,
    maxBufferHole: 2.0,
    highBufferWatchdogPeriod: 3,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 12,
    maxFragLookUpTolerance: 0.5,
    maxAudioFramesDrift: 3,
    stretchShortVideoTrack: true,
    fragLoadingTimeOut: 90000,
    manifestLoadingTimeOut: 45000,
    levelLoadingTimeOut: 45000,
    fragLoadingMaxRetry: 10,
    fragLoadingRetryDelay: 1500,
    manifestLoadingMaxRetry: 6,
    levelLoadingMaxRetry: 6,
    startLevel: -1,
    capLevelToPlayerSize: false,
    testBandwidth: false,
    abrEwmaDefaultEstimate: 8000000,
    startFragPrefetch: true,
    backBufferLength: 45,
    maxStarvationDelay: 4,
    maxLoadingDelay: 4,
  });
}

function formatQualityLabel(level) {
  if (!level) return "—";
  if (level.height) return level.height + "p";
  if (level.width && level.height) return level.width + "x" + level.height;
  return "Level";
}

function formatQualityLabelFromHeight(height) {
  if (!height || !isFinite(height)) return "—";
  return Math.round(height) + "p";
}

function notifyQualityChange(info) {
  for (var i = 0; i < qualityChangeListeners.length; i++) {
    try {
      qualityChangeListeners[i](info);
    } catch (e) {
      /* ignore */
    }
  }
}

function onQualityChange(callback) {
  if (typeof callback !== "function") return function () {};
  qualityChangeListeners.push(callback);
  return function () {
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
    out.push({ level: i, label: label, bitrate: level.bitrate || 0, height: level.height || 0 });
  }
  return out;
}

function getCurrentQuality(hls, video) {
  if (hls && hls.levels && hls.levels.length) {
    var pref = config.getQualityPreference();
    var targetAuto = config.getTargetResolution() === "auto";
    var isAuto = (pref.mode === "auto" || hls.currentLevel === -1) && targetAuto;
    var activeIndex = isAuto ? hls.loadLevel : hls.currentLevel;
    if (activeIndex == null || activeIndex < 0) activeIndex = hls.loadLevel;
    if (activeIndex == null || activeIndex < 0) activeIndex = 0;
    var activeLevel = hls.levels[activeIndex];
    var height = activeLevel && activeLevel.height ? activeLevel.height : 0;
    var label = height ? formatQualityLabelFromHeight(height) : "—";
    if (!height && activeLevel) {
      label = formatQualityLabel(activeLevel);
      if (label === "Level") label = "—";
    }
    return {
      label: label,
      height: height,
      isAuto: isAuto,
      badge: isAuto && label !== "—" ? "Auto · " + label : label,
    };
  }
  if (video && video.videoHeight) {
    var nativeLabel = formatQualityLabelFromHeight(video.videoHeight);
    return { label: nativeLabel, height: video.videoHeight, isAuto: true, badge: nativeLabel };
  }
  return { label: "—", height: 0, isAuto: true, badge: "—" };
}

function logTargetQualityWarning(hls, onLog, sourceLabel) {
  var target = config.getTargetResolution();
  if (target === "auto" || !hls || !hls.levels || !hls.levels.length) return;
  var targetPx = config.targetResolutionPixels(target);
  if (!targetPx) return;
  var info = getCurrentQuality(hls, hls.media);
  if (!info.height || info.height >= targetPx) return;
  var want = config.preferredQualityForTarget(target) || target + "p";
  var maxLevel = 0;
  for (var i = 0; i < hls.levels.length; i++) {
    var lh = hls.levels[i].height || 0;
    if (lh > maxLevel) maxLevel = lh;
  }
  var msg = "Playing " + info.label + " (" + want + " requested)";
  if (maxLevel > 0) {
    msg += " — manifest max " + maxLevel + "p";
  }
  if (sourceLabel) {
    msg += " [" + sourceLabel + "]";
  }
  debug.debugLog(msg);
  if (onLog) onLog(msg);
}

function applyQualityPreference(hls, onLog) {
  if (!hls) return;
  var pref = config.getQualityPreference();
  if (pref.mode === "manual" && pref.level >= 0) {
    hls.currentLevel = pref.level;
    logTargetQualityWarning(hls, onLog);
    return;
  }

  var target = config.getTargetResolution();
  if (target === "auto") {
    hls.currentLevel = -1;
    if (typeof hls.minAutoBitrate === "number") hls.minAutoBitrate = 0;
    var lowIdx = config.levelIndexForTargetHeight(hls, 0);
    if (lowIdx >= 0) hls.startLevel = lowIdx;
    return;
  }

  var targetPx = config.targetResolutionPixels(target);
  var level = config.levelIndexForTargetHeight(hls, targetPx);
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
  var level = config.levelIndexForLegacyMode(hls, mode);
  if (level < 0) return;
  hls.currentLevel = level;
}

function setQualityLevel(hls, level) {
  if (!hls) return false;
  if (level < 0) {
    config.setQualityAuto();
    hls.currentLevel = -1;
    if (typeof hls.minAutoBitrate === "number") hls.minAutoBitrate = 0;
    var lowIdx = config.levelIndexForTargetHeight(hls, 0);
    if (lowIdx >= 0) hls.startLevel = lowIdx;
    notifyQualityChange(getCurrentQuality(hls, hls.media));
    return true;
  }
  var levels = hls.levels ? hls.levels.length : 0;
  if (!levels || level >= levels) return false;
  config.setQualityLevel(level);
  hls.currentLevel = level;
  notifyQualityChange(getCurrentQuality(hls, hls.media));
  return true;
}

function reportPlaybackHealth(success) {
  if (playbackReported || !currentProvider) return;
  playbackReported = true;
  var base = config.getApiBase();
  fetch(base + "/play/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: currentProvider, success: success }),
  }).catch(function () {
    /* TV may block or API offline */
  });
}

function setupPlaybackHealthReport(video, session) {
  var reported = false;
  var timer = setTimeout(function () {
    if (!isActiveSession(session) || reported) return;
    if (!video.paused && video.currentTime > 5) {
      reported = true;
      reportPlaybackHealth(true);
    }
  }, 6000);
  trackCleanup(function () {
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
      if (onLog) onLog("Buffer primed " + Math.floor(ahead) + "s — starting smooth playback");
      attemptPlay(video, onLog);
    } else if (ahead >= HLS_EARLY_START_BUFFER_SEC && label === "frag") {
      started = true;
      debug.debugLog("HLS early start " + Math.floor(ahead) + "s after first fragment");
      if (onLog) onLog("Starting with " + Math.floor(ahead) + "s buffered");
      attemptPlay(video, onLog);
    }
  }

  function onProgress() {
    maybeStart("progress");
  }

  video.addEventListener("progress", onProgress);
  trackCleanup(function () {
    video.removeEventListener("progress", onProgress);
  });

  if (hls && Hls.Events && Hls.Events.FRAG_BUFFERED) {
    hls.on(Hls.Events.FRAG_BUFFERED, function () {
      maybeStart("frag");
    });
  }

  setTimeout(function () {
    if (started || !isActiveSession(session)) return;
    var ahead = bufferedAheadSec(video);
    debug.debugLog("HLS prime timeout — starting with " + Math.floor(ahead) + "s buffered");
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
      else if (now - lowSince > 3000) {
        lowSince = 0;
        recoverNonFatalHlsError(hls, video, { details: "bufferStalledError" }, onLog);
      }
    } else {
      lowSince = 0;
    }
  }

  video.addEventListener("timeupdate", checkBuffer);
  trackCleanup(function () {
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
    stallTimer = setTimeout(function () {
      if (!isActiveSession(session) || !hls) return;
      var ahead = bufferedAheadSec(video);
      if (ahead > 3) return;
      var msg = "Long stall (" + Math.floor(ahead) + "s ahead) — recovering";
      debug.debugLog(msg);
      if (onLog) onLog(msg);
      try {
        if (hls.media) hls.recoverMediaError();
      } catch (e) {
        /* ignore */
      }
      safePlay(video);
    }, 20000);
  }

  video.addEventListener("waiting", onWaiting);
  video.addEventListener("playing", clearStall);
  trackCleanup(function () {
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
      applyQualityPreference(hls, onLog);
      safePlay(video);
    } catch (e) {
      /* ignore */
    }
    return true;
  }

  if (details === "fragLoadTimeOut" || details === "fragLoadError") {
    try {
      hls.startLoad(-1);
      applyQualityPreference(hls, onLog);
    } catch (e) {
      /* ignore */
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
    if (now - last < 20000) return;
    hlsWarnLast[details] = now;
  }
  debug.debugLog(msg);
  if (onLog) onLog(msg);
}

function playHlsJs(video, url, onLog, videoWrap, title, session, onFatal) {
  debug.debugLog("Player path: HLS.js");
  if (onLog) onLog("Player path: HLS.js — priming buffer...");
  hlsWarnLast = {};
  setCrossOrigin(video, true);
  hlsInstance = createHlsInstance();
  var fatalRetries = 0;
  hlsInstance.loadSource(url);
  hlsInstance.attachMedia(video);
  setupHlsStallRecovery(video, hlsInstance, session, onLog);
  setupBufferWatchdog(video, hlsInstance, session, onLog);
  hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
    if (!isActiveSession(session)) return;
    var levelCount = hlsInstance.levels ? hlsInstance.levels.length : 0;
    var maxH = 0;
    if (hlsInstance.levels) {
      for (var li = 0; li < hlsInstance.levels.length; li++) {
        var lh = hlsInstance.levels[li].height || 0;
        if (lh > maxH) maxH = lh;
      }
    }
    debug.debugLog(
      "HLS.js manifest parsed — levels: " +
        levelCount +
        ", max height: " +
        (maxH ? maxH + "p" : "unknown")
    );
    if (onLog) {
      onLog(
        "HLS.js manifest parsed — " +
          levelCount +
          " level(s)" +
          (maxH ? ", max " + maxH + "p" : "")
      );
    }
    applyQualityPreference(hlsInstance, onLog);
    notifyQualityChange(getCurrentQuality(hlsInstance, video));
    setupPlaybackHealthReport(video, session);
    startHlsPlaybackWhenBuffered(video, videoWrap, title, onLog, session, hlsInstance);
  });
  hlsInstance.on(Hls.Events.LEVEL_SWITCHED, function () {
    if (!isActiveSession(session)) return;
    notifyQualityChange(getCurrentQuality(hlsInstance, video));
  });
  hlsInstance.on(Hls.Events.LEVEL_LOADED, function (event, data) {
    if (!isActiveSession(session) || !data || !data.details) return;
    var h = data.details.height;
    var w = data.details.width;
    if (w && h) {
      var q = "Quality: " + w + "x" + h;
      debug.debugLog(q);
      if (onLog) onLog(q);
    }
    notifyQualityChange(getCurrentQuality(hlsInstance, video));
  });
  hlsInstance.on(Hls.Events.ERROR, function (event, data) {
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

    // Manifest-level fatals mean hls.js already exhausted its internal manifest
    // retries (manifestLoadingMaxRetry) against a manifest that is missing,
    // expired (stale prefetch / inline-manifest token) or unparseable. Retrying
    // startLoad(-1) cannot re-fetch a dead manifest — it only delays the source
    // fallback and, when no fallback fires, surfaces as a FATAL to the user.
    // Fail fast so playSources advances to the next source / escalation tier.
    var isManifestFatal =
      data.details === "manifestLoadError" ||
      data.details === "manifestLoadTimeOut" ||
      data.details === "manifestParsingError";

    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !isManifestFatal && fatalRetries < 3) {
      fatalRetries += 1;
      debug.debugLog("HLS network error — retry " + fatalRetries);
      if (onLog) onLog("HLS network error — retry " + fatalRetries);
      try {
        hlsInstance.startLoad(-1);
      } catch (e) {
        /* ignore */
      }
      return;
    }

    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && fatalRetries < 3) {
      fatalRetries += 1;
      debug.debugLog("HLS media error — recover " + fatalRetries);
      if (onLog) onLog("HLS media error — recover " + fatalRetries);
      try {
        hlsInstance.recoverMediaError();
      } catch (e) {
        /* ignore */
      }
      return;
    }

    if (hlsInstance) {
      try {
        hlsInstance.detachMedia();
      } catch (e) {
        /* ignore */
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
  trackCleanup(function () {
    video.removeEventListener("loadedmetadata", reportNativeQuality);
    video.removeEventListener("resize", reportNativeQuality);
    if (nativeQualityVideo === video) nativeQualityVideo = null;
  });
}

function playNativeHls(video, url, onLog, videoWrap, title, session, onStallFallback, onFatal) {
  debug.debugLog("Player path: native HLS");
  if (onLog) onLog("Player path: native HLS (wait up to 5s, then HLS.js fallback)");
  setCrossOrigin(video, false);
  video.src = url;
  setupNativeQualityTracking(video, session);

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
      fallback("Native HLS video error — falling back to HLS.js");
      return;
    }
    if (onFatal) {
      onFatal("Native HLS video error");
    }
  }
  video.addEventListener("error", onVideoError);
  trackCleanup(function () {
    video.removeEventListener("error", onVideoError);
  });

  startPlaybackWhenReady(video, videoWrap, title, onLog, {
    session: session,
    onStall: function () {
      if (video.networkState === 3) {
        debug.debugLog("Native HLS: networkState=no_source");
        if (onLog) onLog("Native HLS: no compatible source");
      }
      if (onStallFallback) {
        fallback("Native HLS stall — falling back to HLS.js");
        return;
      }
      if (onFatal) {
        onFatal("Native HLS stall");
      }
    },
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
      playNativeHls(video, url, onLog, videoWrap, title, session, function () {
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
  startPlaybackWhenReady(video, videoWrap, title, onLog, { session: session });
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
    debug.debugLog("No sources to play");
    if (onLog) onLog("No sources to play");
    return;
  }

  destroyPlayer(video);
  var index = 0;
  currentProvider = sources[0] && sources[0].provider ? sources[0].provider : null;
  playbackReported = false;
  nonFatalRecoveries = 0;

  if (options.warmedManifestUrl && sources[0] && sources[0].url === options.warmedManifestUrl) {
    debug.debugLog("Using warmed manifest");
    if (onLog) onLog("Using warmed manifest");
  }

  var lastFailureReason = null;

  function tryNext(reason) {
    if (reason) {
      lastFailureReason = reason;
      debug.debugLog(reason);
      if (onLog) onLog(reason);
    }
    if (index >= sources.length) {
      var done = "All sources failed — CDN may be blocking playback";
      debug.debugLog(done);
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
          /* ignore */
        }
        try {
          hlsInstance.detachMedia();
        } catch (e) {
          /* ignore */
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
    else debug.debugLog(label);

    playUrlAttempt(video, source.url, onLog, videoWrap, title, source.type, function (fatalMsg) {
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
    safePlay(video, function (msg) {
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
    debug.debugLog("Seek failed: " + err.message);
  }
}

function getPlaybackState(video) {
  if (!video) return { currentTime: 0, duration: 0, paused: true };
  return {
    currentTime: video.currentTime || 0,
    duration: video.duration && isFinite(video.duration) ? video.duration : 0,
    paused: !!video.paused,
  };
}

function isMediaPlayPauseKey(e) {
  if (!e) return false;
  if (e.key === "MediaPlayPause") return true;
  if (e.keyCode === 415 || e.keyCode === 10252 || e.keyCode === 179) return true;
  return false;
}

module.exports = {
  destroyPlayer: destroyPlayer,
  playUrl: playUrl,
  playSources: playSources,
  playDirect: playDirect,
  showVideoWrap: showVideoWrap,
  enterPlaybackMode: enterPlaybackMode,
  showPlaybackChrome: showPlaybackChrome,
  exitPlaybackMode: exitPlaybackMode,
  applySubtitles: applySubtitles,
  selectSubtitle: selectSubtitle,
  bindSubtitleButton: bindSubtitleButton,
  cycleSubtitles: cycleSubtitles,
  seekBy: seekBy,
  getPlaybackState: getPlaybackState,
  isTizenTv: isTizenTv,
  logVideoState: logVideoState,
  safePlay: safePlay,
  togglePlayPause: togglePlayPause,
  isMediaPlayPauseKey: isMediaPlayPauseKey,
  getQualityOptions: getQualityOptions,
  applyQualityMode: applyQualityMode,
  applyQualityPreference: applyQualityPreference,
  setQualityLevel: setQualityLevel,
  getCurrentQuality: getCurrentQuality,
  onQualityChange: onQualityChange,
  formatQualityLabel: formatQualityLabel,
  setResumePosition: setResumePosition,
  getHlsInstance: function () {
    return hlsInstance;
  },
};
