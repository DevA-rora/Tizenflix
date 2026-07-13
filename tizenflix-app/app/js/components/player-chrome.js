/**
 * Netflix-style fullscreen player chrome — overlay, panels, episode rail.
 */

var player = require("../player/player.js");
var playerFocus = require("../core/player-focus.js");
var api = require("../services/api.js");
var config = require("../core/config.js");
var playbackSession = require("../services/playback-session.js");
var keys = require("../core/keys.js");

var chromeEl = null;
var handlers = {};
var hideTimer = null;
var timeThrottle = 0;
var railOpen = false;
var panelOpen = null;
var providersCache = null;

var HIDE_MS = 5000;
var VIDKING_SERVERS = ["Oxygen", "Titanium", "Helium", "Hydrogen", "Lithium"];

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(seconds) {
  if (!seconds || seconds < 0 || !isFinite(seconds)) return "0:00";
  var s = Math.floor(seconds);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var mm = m < 10 ? "0" + m : String(m);
  var ss = sec < 10 ? "0" + sec : String(sec);
  if (h > 0) return h + ":" + mm + ":" + ss;
  return m + ":" + ss;
}

function iconBack() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
}

function iconClose() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
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
  hideTimer = setTimeout(function () {
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
  }
  resetHideTimer();
  playerFocus.focusDefault();
}

function closeRail() {
  railOpen = false;
  if (!chromeEl) return;
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
  else if (name === "quality" || name === "settings") renderSettingsPanel(panel);
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
    show();
    loadRailEpisodes(rail);
    if (hideTimer) clearTimeout(hideTimer);
  } else {
    rail.classList.add("hidden");
    resetHideTimer();
  }
}

function renderSubsPanel(panel) {
  var session = playbackSession.get();
  var subs = (session && session.subtitles) || [];
  var html = '<h3 class="player-panel-title">Audio &amp; Subtitles</h3><div data-player-zone="panel">';
  html +=
    '<button type="button" class="player-panel-item focusable" data-sub-index="-1" aria-label="Subtitles off">Off</button>';
  for (var i = 0; i < subs.length; i++) {
    var label = subs[i].label || subs[i].language || "Track " + (i + 1);
    html +=
      '<button type="button" class="player-panel-item focusable" data-sub-index="' +
      i +
      '" aria-label="' +
      escapeHtml(label) +
      '">' +
      escapeHtml(label) +
      "</button>";
  }
  html += "</div>";
  panel.innerHTML = html;
  bindPanelItems(panel, function (btn) {
    var idx = parseInt(btn.getAttribute("data-sub-index"), 10);
    if (handlers.onSubtitleSelect) handlers.onSubtitleSelect(idx);
    closePanel();
  });
}

function renderSettingsPanel(panel) {
  var modes = ["auto", "high", "medium", "low"];
  var current = config.getQualityMode();
  var speed = config.getPlaybackSpeed();
  var html = '<h3 class="player-panel-title">Settings</h3><div data-player-zone="panel">';
  html += '<p class="player-panel-hint">Quality</p>';
  for (var i = 0; i < modes.length; i++) {
    var m = modes[i];
    var active = m === current ? " is-active" : "";
    html +=
      '<button type="button" class="player-panel-item focusable' +
      active +
      '" data-quality="' +
      m +
      '" aria-label="Quality ' +
      m +
      '">' +
      m.charAt(0).toUpperCase() +
      m.slice(1) +
      "</button>";
  }
  html +=
    '<p class="player-panel-hint">Playback speed</p>' +
    '<button type="button" class="player-panel-item focusable is-active" data-speed="cycle" aria-label="Playback speed">' +
    speed +
    "x</button>";
  html += "</div>";
  panel.innerHTML = html;
  bindPanelItems(panel, function (btn) {
    var mode = btn.getAttribute("data-quality");
    if (mode && handlers.onQualitySelect) handlers.onQualitySelect(mode);
    if (btn.getAttribute("data-speed") && handlers.onSpeedCycle) handlers.onSpeedCycle();
    closePanel();
  });
}

function renderServerPanel(panel) {
  var session = playbackSession.get();
  panel.innerHTML = '<h3 class="player-panel-title">Server</h3><div class="player-panel-loading">Loading…</div>';
  var html = '<h3 class="player-panel-title">Server</h3><div data-player-zone="panel">';
  html += '<p class="player-panel-hint">Stream sources</p>';

  var sources = (session && session.sources) || [];
  for (var i = 0; i < sources.length; i++) {
    var src = sources[i];
    var label = src.label || src.provider || src.sourceId || "Source " + (i + 1);
    var active = session && session.currentSourceIndex === i ? " is-active" : "";
    html +=
      '<button type="button" class="player-panel-item focusable' +
      active +
      '" data-source-index="' +
      i +
      '" aria-label="' +
      escapeHtml(label) +
      '">' +
      escapeHtml(label) +
      "</button>";
  }

  html += '<p class="player-panel-hint">Vidking servers</p>';
  for (var v = 0; v < VIDKING_SERVERS.length; v++) {
    var server = VIDKING_SERVERS[v];
    html +=
      '<button type="button" class="player-panel-item focusable" data-vidking="' +
      escapeHtml(server) +
      '" aria-label="Vidking ' +
      escapeHtml(server) +
      '">' +
      escapeHtml(server) +
      "</button>";
  }

  html += '<p class="player-panel-hint">TMDB-native sources</p>';
  html += '<div class="player-panel-native" data-native-list>Loading providers…</div>';
  html += "</div>";
  panel.innerHTML = html;

  bindPanelItems(panel, function (btn) {
    if (btn.hasAttribute("data-source-index")) {
      var idx = parseInt(btn.getAttribute("data-source-index"), 10);
      if (!isNaN(idx) && handlers.onSourceSwitch) {
        handlers.onSourceSwitch(idx);
      }
      return;
    }
    var vk = btn.getAttribute("data-vidking");
    if (vk && handlers.onReResolve) {
      handlers.onReResolve({ server: vk, backend: "vidking" });
      return;
    }
    var nativeId = btn.getAttribute("data-native-id");
    if (nativeId && handlers.onReResolve) {
      config.setPreferredSourceId(nativeId);
      handlers.onReResolve({ onlySourceId: nativeId, backend: "tmdb-native" });
    }
  });

  loadNativeProviders(panel);
}

function loadNativeProviders(panel) {
  var container = panel.querySelector("[data-native-list]");
  if (!container) return;
  if (providersCache) {
    renderNativeList(container, providersCache);
    return;
  }
  api.getProviders().then(function (data) {
    providersCache = data.sources || data.providers || [];
    renderNativeList(container, providersCache);
  }).catch(function () {
    container.textContent = "Providers unavailable";
  });
}

function renderNativeList(container, providers) {
  var html = "";
  if (!providers || !providers.length) {
    container.textContent = "No providers";
    return;
  }
  for (var i = 0; i < providers.length; i++) {
    var p = providers[i];
    var id = p.id || p.sourceId || "";
    var label = p.label || p.name || id;
    if (!id) continue;
    html +=
      '<button type="button" class="player-panel-item focusable" data-native-id="' +
      escapeHtml(id) +
      '" aria-label="' +
      escapeHtml(label) +
      '">' +
      escapeHtml(label) +
      "</button>";
  }
  container.innerHTML = html;
}

function bindPanelItems(panel, onClick) {
  var buttons = panel.querySelectorAll(".player-panel-item");
  for (var i = 0; i < buttons.length; i++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        onClick(btn);
      });
    })(buttons[i]);
  }
}

function loadRailEpisodes(rail) {
  var session = playbackSession.get();
  if (!session || session.type !== "tv") return;
  var list = rail.querySelector(".player-rail-list");
  if (!list) return;
  list.innerHTML = '<div class="loading-msg">Loading episodes…</div>';

  api.getEpisodes(session.tmdbId, session.season).then(function (data) {
    var episodes = data.episodes || [];
    list.innerHTML = "";
    for (var i = 0; i < episodes.length; i++) {
      (function (ep) {
        var active =
          ep.episode === session.episode ? " player-rail-card-active" : "";
        var still = ep.still
          ? ' style="background-image:url(\'' + escapeHtml(ep.still) + '\')"'
          : "";
        var card = document.createElement("button");
        card.type = "button";
        card.className = "player-rail-card focusable" + active;
        card.setAttribute("data-player-zone", "rail");
        card.setAttribute("aria-label", "Episode " + ep.episode);
        card.innerHTML =
          '<div class="player-rail-thumb"' +
          still +
          "></div>" +
          '<div class="player-rail-meta"><strong>' +
          ep.episode +
          ". " +
          escapeHtml(ep.title) +
          "</strong></div>";
        card.addEventListener("click", function () {
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
  }).catch(function (err) {
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

  var pct = duration > 0 ? (current / duration) * 100 : 0;
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
  video.addEventListener("timeupdate", function () {
    updateProgress(video);
  });
  video.addEventListener("play", function () {
    updatePlayPauseIcon(video);
  });
  video.addEventListener("pause", function () {
    updatePlayPauseIcon(video);
  });
  video.addEventListener("loadedmetadata", function () {
    updateProgress(video);
  });
  video.addEventListener("volumechange", function () {
    updateVolumeIcon(video);
  });
}

function getZones() {
  if (!chromeEl) return {};
  return {
    top: chromeEl.querySelector('[data-player-zone="top"]'),
    progress: chromeEl.querySelector('[data-player-zone="progress"]'),
    dock: chromeEl.querySelector('[data-player-zone="dock"]'),
    rail: chromeEl.querySelector(".player-rail"),
    panel: chromeEl.querySelector(".player-panel"),
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
  chromeEl.innerHTML =
    '<div class="player-vignette-top"></div>' +
    '<div class="player-vignette-bottom"></div>' +
    '<div class="player-top" data-player-zone="top">' +
    '<button type="button" class="player-icon-btn focusable" id="playerBack" aria-label="Back">' +
    iconBack() +
    "</button>" +
    '<button type="button" class="player-icon-btn focusable" id="playerServer" aria-label="Server">' +
    iconServer() +
    "</button>" +
    "</div>" +
    '<div class="player-progress-wrap" data-player-zone="progress">' +
    '<span class="player-progress-time">0:00</span>' +
    '<div class="player-progress-track">' +
    '<div class="player-progress-fill"></div>' +
    '<div class="player-progress-scrub"></div>' +
    "</div>" +
    "</div>" +
    '<div class="player-dock" data-player-zone="dock">' +
    '<div class="player-dock-left">' +
    '<button type="button" class="player-dock-btn focusable" id="playerPlayPause" aria-label="Pause">' +
    iconPause() +
    "</button>" +
    '<button type="button" class="player-dock-btn focusable" id="playerRewind" aria-label="Rewind 10 seconds">' +
    iconRewind() +
    "</button>" +
    '<button type="button" class="player-dock-btn focusable" id="playerForward" aria-label="Forward 10 seconds">' +
    iconForward() +
    "</button>" +
    '<button type="button" class="player-dock-btn focusable" id="playerVolume" aria-label="Mute">' +
    iconVolume() +
    "</button>" +
    "</div>" +
    '<div class="player-dock-title">' +
    escapeHtml(buildDockTitle(session)) +
    "</div>" +
    '<div class="player-dock-right">' +
    (isTv && hasNext
      ? '<button type="button" class="player-dock-btn focusable" id="playerNext" aria-label="Next episode">' +
        iconNext() +
        "</button>"
      : "") +
    (isTv
      ? '<button type="button" class="player-dock-btn focusable" id="playerEpisodes" aria-label="Episodes">' +
        iconEpisodes() +
        "</button>"
      : "") +
    '<button type="button" class="player-dock-btn focusable" id="playerSubs" aria-label="Audio and Subtitles">' +
    iconSubtitles() +
    "</button>" +
    '<button type="button" class="player-dock-btn focusable" id="playerSettings" aria-label="Settings">' +
    iconSettings() +
    "</button>" +
    "</div>" +
    "</div>" +
    '<div class="player-rail hidden">' +
    '<div class="player-rail-header">Episodes</div>' +
    '<div class="player-rail-list"></div>' +
    "</div>" +
    '<div class="player-panel hidden"></div>';

  wrap.appendChild(chromeEl);

  var video = document.getElementById("video");
  bindVideoEvents(video);
  updateProgress(video);
  updatePlayPauseIcon(video);
  updateVolumeIcon(video);

  playerFocus.setZoneProvider(getZones);
  playerFocus.init(handlers.onFocusChange);
  playerFocus.focusDefault();

  chromeEl.querySelector("#playerBack").addEventListener("click", function () {
    handleUiBack();
  });
  chromeEl.querySelector("#playerServer").addEventListener("click", function () {
    openPanel("server");
  });
  chromeEl.querySelector("#playerRewind").addEventListener("click", function () {
    if (handlers.onSeek) handlers.onSeek(-10);
    resetHideTimer();
  });
  chromeEl.querySelector("#playerForward").addEventListener("click", function () {
    if (handlers.onSeek) handlers.onSeek(10);
    resetHideTimer();
  });
  chromeEl.querySelector("#playerPlayPause").addEventListener("click", function () {
    if (handlers.onPlayPause) handlers.onPlayPause();
    resetHideTimer();
  });
  chromeEl.querySelector("#playerVolume").addEventListener("click", function () {
    video.muted = !video.muted;
    updateVolumeIcon(video);
    resetHideTimer();
  });

  var epBtn = chromeEl.querySelector("#playerEpisodes");
  if (epBtn) {
    epBtn.addEventListener("click", function () {
      toggleRail();
    });
  }
  chromeEl.querySelector("#playerSubs").addEventListener("click", function () {
    openPanel("subs");
  });
  chromeEl.querySelector("#playerSettings").addEventListener("click", function () {
    openPanel("settings");
  });
  var nextBtn = chromeEl.querySelector("#playerNext");
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (handlers.onNextEpisode) handlers.onNextEpisode();
    });
  }

  var progressBtn = chromeEl.querySelector(".player-progress-wrap");
  if (progressBtn) {
    progressBtn.setAttribute("tabindex", "0");
    progressBtn.classList.add("focusable");
    progressBtn.addEventListener("click", function () {
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
    if (keys.isBackKey(e)) return;
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
  if (isVisible()) {
    hide();
    return true;
  }
  return false;
}

function handleUiBack() {
  if (panelOpen) {
    closePanel();
    return;
  }
  if (railOpen) {
    closeRail();
    return;
  }
  if (handlers.onStop) handlers.onStop();
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
  mount: mount,
  destroy: destroy,
  show: show,
  hide: hide,
  isVisible: isVisible,
  handleBack: handleBack,
  closePanel: closePanel,
  closeRail: closeRail,
  updateProgress: updateProgress,
  updatePlayPauseIcon: updatePlayPauseIcon,
};
