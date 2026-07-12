/**
 * Netflix-style detail hero — backdrop/trailer, logo, metadata, reactions, Play, My List.
 */

var mylist = require("../services/mylist.js");

var activeVideoEl = null;
var activePlayer = null;
var videoTimeout = null;
var ytApiLoading = false;
var ytApiQueue = [];
var BACKGROUND_VOLUME = 20;

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + "…";
}

function formatRuntime(minutes) {
  if (!minutes || minutes <= 0) return "";
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  if (h > 0 && m > 0) return h + "h " + m + "m";
  if (h > 0) return h + "h";
  return m + "m";
}

function buildMetaParts(title) {
  var parts = [];
  if (title.year) parts.push(String(title.year));
  if (title.genres && title.genres.length) parts.push(title.genres[0]);
  var runtime = formatRuntime(title.runtime);
  if (runtime) parts.push(runtime);
  return parts;
}

function buildMetaHtml(title) {
  var parts = buildMetaParts(title);
  var html = "";
  for (var i = 0; i < parts.length; i++) {
    if (i > 0) html += '<span class="detail-meta-dot">•</span>';
    html += "<span>" + escapeHtml(parts[i]) + "</span>";
  }
  if (title.certification) {
    if (parts.length) html += '<span class="detail-meta-dot">•</span>';
    html +=
      '<span class="detail-rating-badge">' + escapeHtml(title.certification) + "</span>";
  }
  return html;
}

function iconBack() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
}

function reactionSvg(type) {
  if (type === "down") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>';
  }
  if (type === "up") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
}

function hideVideoLayer(container) {
  var layer = container.querySelector(".detail-video-bg");
  if (layer) layer.classList.add("hidden");
}

function stopBackgroundVideo() {
  if (videoTimeout) {
    clearTimeout(videoTimeout);
    videoTimeout = null;
  }
  if (activePlayer) {
    try {
      if (activePlayer.destroy) activePlayer.destroy();
    } catch (err) {
      /* ignore */
    }
    activePlayer = null;
  }
  if (activeVideoEl) {
    var parent = activeVideoEl.parentNode;
    if (parent) parent.removeChild(activeVideoEl);
    activeVideoEl = null;
  }
}

function loadYouTubeApi(callback) {
  if (window.YT && window.YT.Player) {
    callback();
    return;
  }
  ytApiQueue.push(callback);
  if (ytApiLoading) return;
  ytApiLoading = true;
  var prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (prevReady) prevReady();
    ytApiLoading = false;
    for (var i = 0; i < ytApiQueue.length; i++) {
      ytApiQueue[i]();
    }
    ytApiQueue = [];
  };
  var tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  var scripts = document.getElementsByTagName("script");
  var anchor = scripts.length ? scripts[0] : null;
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(tag, anchor);
  } else {
    document.head.appendChild(tag);
  }
}

function startLowVolumePlayback(player) {
  if (!player || !player.setVolume) return;
  player.setVolume(BACKGROUND_VOLUME);
  if (player.unMute) player.unMute();
  if (player.playVideo) player.playVideo();
}

function onPlayerStateChange(event) {
  if (!event || !event.data || !event.target) return;
  if (event.data === 1) {
    event.target.setVolume(BACKGROUND_VOLUME);
    if (event.target.unMute) event.target.unMute();
  }
}

function setupBackgroundVideo(container, trailerKey) {
  if (!trailerKey) return;

  var layer = container.querySelector(".detail-video-bg");
  if (!layer) return;

  var playerId = "detail-yt-" + String(Date.now());
  var mount = document.createElement("div");
  mount.id = playerId;
  mount.className = "detail-video-iframe";
  layer.appendChild(mount);
  activeVideoEl = mount;

  videoTimeout = setTimeout(function () {
    hideVideoLayer(container);
  }, 5000);

  loadYouTubeApi(function () {
    if (!document.getElementById(playerId)) return;
    try {
      activePlayer = new window.YT.Player(playerId, {
        videoId: trailerKey,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          loop: 1,
          playlist: trailerKey,
          fs: 0,
          iv_load_policy: 3,
          enablejsapi: 1,
        },
        events: {
          onReady: function (event) {
            if (videoTimeout) {
              clearTimeout(videoTimeout);
              videoTimeout = null;
            }
            startLowVolumePlayback(event.target);
          },
          onStateChange: onPlayerStateChange,
          onError: function () {
            hideVideoLayer(container);
          },
        },
      });
    } catch (err) {
      hideVideoLayer(container);
    }
  });
}

function updateMyListBtn(btn, title) {
  if (mylist.has(title.id)) {
    btn.textContent = "✓ In My List";
    btn.setAttribute("aria-label", "Remove from My List");
  } else {
    btn.textContent = "+ Add to My List";
    btn.setAttribute("aria-label", "Add to My List");
  }
}

function updateReactionButtons(container, titleId) {
  var reaction = mylist.getReaction(titleId);
  var buttons = container.querySelectorAll(".detail-reaction");
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    var type = btn.getAttribute("data-reaction");
    if (type === reaction) btn.classList.add("is-active");
    else btn.classList.remove("is-active");
  }
}

function render(title, options) {
  options = options || {};
  var playLabel = options.playLabel || "▶ Play";
  var backdrop = title.backdrop || title.poster || "";
  var overview = truncate(title.overview || "", 280);
  var reaction = mylist.getReaction(title.id);
  var inList = mylist.has(title.id);

  var titleHtml = "";
  if (title.logo) {
    titleHtml =
      '<img class="detail-logo" src="' +
      escapeHtml(title.logo) +
      '" alt="' +
      escapeHtml(title.title) +
      '">';
  } else {
    titleHtml = '<h1 class="detail-title">' + escapeHtml(title.title) + "</h1>";
  }

  var videoLayer = title.trailerKey
    ? '<div class="detail-video-bg"></div>'
    : "";

  var el = document.createElement("div");
  el.className = "detail-hero";
  el.innerHTML =
    videoLayer +
    '<div class="detail-backdrop" style="background-image:url(\'' +
    escapeHtml(backdrop) +
    '\')"></div>' +
    '<div class="detail-gradient"></div>' +
    '<div class="detail-top" data-focus-row="detail-top">' +
    '<button type="button" class="detail-back-btn focusable" id="detailBackBtn" aria-label="Back">' +
    iconBack() +
    "</button>" +
    "</div>" +
    '<div class="detail-content">' +
    titleHtml +
    '<div class="detail-meta-row">' +
    buildMetaHtml(title) +
    "</div>" +
    '<p class="detail-overview">' +
    escapeHtml(overview) +
    "</p>" +
    '<div class="detail-reactions" data-focus-row="detail-reactions">' +
    '<button type="button" class="detail-reaction focusable' +
    (reaction === "down" ? " is-active" : "") +
    '" data-reaction="down" aria-label="Not for me">' +
    reactionSvg("down") +
    "</button>" +
    '<button type="button" class="detail-reaction focusable' +
    (reaction === "up" ? " is-active" : "") +
    '" data-reaction="up" aria-label="I like this">' +
    reactionSvg("up") +
    "</button>" +
    '<button type="button" class="detail-reaction focusable' +
    (reaction === "love" ? " is-active" : "") +
    '" data-reaction="love" aria-label="Love this">' +
    reactionSvg("love") +
    "</button>" +
    "</div>" +
    '<div class="detail-play-row" data-focus-row="detail-play">' +
    '<button type="button" class="btn btn-play focusable" id="detailPlayBtn">' +
    escapeHtml(playLabel) +
    "</button>" +
    "</div>" +
    '<div class="detail-mylist-row" data-focus-row="detail-mylist">' +
    '<button type="button" class="detail-mylist-btn focusable" id="detailMyListBtn" aria-label="' +
    (inList ? "Remove from My List" : "Add to My List") +
    '">' +
    (inList ? "✓ In My List" : "+ Add to My List") +
    "</button>" +
    "</div>" +
    "</div>";

  var playBtn = el.querySelector("#detailPlayBtn");
  var myListBtn = el.querySelector("#detailMyListBtn");
  var backBtn = el.querySelector("#detailBackBtn");
  var reactionBtns = el.querySelectorAll(".detail-reaction");

  if (backBtn && options.onBack) {
    backBtn.addEventListener("click", options.onBack);
  }

  if (playBtn && options.onPlay) {
    playBtn.addEventListener("click", options.onPlay);
  }

  if (myListBtn) {
    myListBtn.addEventListener("click", function () {
      if (mylist.has(title.id)) {
        mylist.remove(title.id);
      } else {
        mylist.add({
          id: title.id,
          type: title.type,
          title: title.title,
          poster: title.poster,
        });
      }
      updateMyListBtn(myListBtn, title);
    });
  }

  for (var i = 0; i < reactionBtns.length; i++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var type = btn.getAttribute("data-reaction");
        mylist.toggleReaction(title.id, type);
        updateReactionButtons(el, title.id);
      });
    })(reactionBtns[i]);
  }

  if (title.trailerKey) {
    setupBackgroundVideo(el, title.trailerKey);
  }

  return el;
}

module.exports = {
  render: render,
  stopBackgroundVideo: stopBackgroundVideo,
};
