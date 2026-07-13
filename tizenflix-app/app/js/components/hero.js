/**
 * Featured hero banner (Netflix-style) — dual-backdrop crossfade, text takeover, trailer preview.
 */

var api = require("../services/api.js");
var motion = require("../core/motion.js");

var logoCache = {};
var detailCache = {};
var pendingLogoFetch = null;
var activeBackdrop = "a";
var updateTimer = null;
var trailerTimer = null;
var activePlayer = null;
var activeVideoMount = null;
var videoTimeout = null;
var ytApiLoading = false;
var ytApiQueue = [];
var BACKGROUND_VOLUME = 20;
var pendingTrailerId = null;

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

function getItemType(item) {
  return item.type || item.mediaType || item.media_type || "movie";
}

function buildMetaHtml(item, certification) {
  var parts = [];
  var type = getItemType(item);
  if (type === "tv") parts.push("TV Series");
  else parts.push("Movie");
  if (item.year) parts.push(String(item.year));
  var html = "";
  for (var i = 0; i < parts.length; i++) {
    if (i > 0) html += '<span class="hero-meta-dot">•</span>';
    html += "<span>" + escapeHtml(parts[i]) + "</span>";
  }
  if (certification) {
    if (parts.length) html += '<span class="hero-meta-dot">•</span>';
    html +=
      '<span class="hero-rating-badge">' + escapeHtml(certification) + "</span>";
  }
  return html;
}

function setTitleDisplay(heroEl, item, logoUrl) {
  var titleWrap = heroEl.querySelector(".hero-title-wrap");
  if (!titleWrap) return;
  var title = item.title || item.name || "Untitled";
  if (logoUrl) {
    titleWrap.innerHTML =
      '<img class="hero-logo" src="' +
      escapeHtml(logoUrl) +
      '" alt="' +
      escapeHtml(title) +
      '">';
  } else {
    titleWrap.innerHTML = '<h1 class="hero-title">' + escapeHtml(title) + "</h1>";
  }
}

function stopHeroTrailer(heroEl) {
  if (trailerTimer) {
    clearTimeout(trailerTimer);
    trailerTimer = null;
  }
  pendingTrailerId = null;
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
  if (activeVideoMount && activeVideoMount.parentNode) {
    activeVideoMount.parentNode.removeChild(activeVideoMount);
    activeVideoMount = null;
  }
  if (heroEl) {
    var layer = heroEl.querySelector(".hero-video-bg");
    if (layer) {
      layer.classList.add("hidden");
      layer.innerHTML = "";
    }
    var backdrops = heroEl.querySelectorAll(".hero-backdrop");
    for (var i = 0; i < backdrops.length; i++) {
      backdrops[i].style.opacity = "";
    }
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

function crossfadeToTrailer(heroEl, trailerKey) {
  if (!heroEl || !trailerKey) return;
  if (heroEl.getAttribute("data-tmdb-id") !== pendingTrailerId) return;
  if (!motion.animationsEnabled()) return;

  var layer = heroEl.querySelector(".hero-video-bg");
  if (!layer) return;

  stopHeroTrailer(heroEl);
  pendingTrailerId = heroEl.getAttribute("data-tmdb-id");

  var playerId = "hero-yt-" + String(Date.now());
  var mount = document.createElement("div");
  mount.id = playerId;
  mount.className = "hero-video-iframe";
  layer.appendChild(mount);
  activeVideoMount = mount;
  layer.classList.remove("hidden");

  var backdrops = heroEl.querySelectorAll(".hero-backdrop.is-active");
  for (var b = 0; b < backdrops.length; b++) {
    backdrops[b].style.opacity = "0";
    backdrops[b].style.transition = "opacity 800ms cubic-bezier(0.2, 0.8, 0.2, 1)";
  }

  videoTimeout = setTimeout(function () {
    stopHeroTrailer(heroEl);
  }, 30000);

  loadYouTubeApi(function () {
    if (!document.getElementById(playerId)) return;
    if (heroEl.getAttribute("data-tmdb-id") !== pendingTrailerId) return;
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
          onReady: function (e) {
            startLowVolumePlayback(e.target);
          },
          onStateChange: onPlayerStateChange,
          onError: function () {
            stopHeroTrailer(heroEl);
          },
        },
      });
    } catch (err) {
      stopHeroTrailer(heroEl);
    }
  });
}

function scheduleHeroTrailer(heroEl, item) {
  if (trailerTimer) clearTimeout(trailerTimer);
  trailerTimer = null;
  stopHeroTrailer(heroEl);

  if (!motion.animationsEnabled()) return;

  var id = String(item.id);
  var profile = motion.getMotionProfile();
  pendingTrailerId = id;

  trailerTimer = setTimeout(function () {
    trailerTimer = null;
    if (heroEl.getAttribute("data-tmdb-id") !== id) return;
    var detail = detailCache[id];
    var trailerKey = detail && detail.trailerKey ? detail.trailerKey : null;
    if (!trailerKey) return;
    crossfadeToTrailer(heroEl, trailerKey);
  }, profile.heroTrailerDelayMs);
}

function fetchDetailExtras(item, heroEl, onReady) {
  var id = String(item.id);
  if (detailCache[id]) {
    if (detailCache[id].logo && !logoCache[id]) {
      logoCache[id] = detailCache[id].logo;
      if (heroEl.getAttribute("data-tmdb-id") === id) {
        setTitleDisplay(heroEl, item, detailCache[id].logo);
      }
    }
    if (detailCache[id].certification && heroEl.getAttribute("data-tmdb-id") === id) {
      var metaEl = heroEl.querySelector(".hero-meta-row");
      if (metaEl) {
        metaEl.innerHTML = buildMetaHtml(item, detailCache[id].certification);
      }
    }
    if (onReady) onReady(detailCache[id]);
    return;
  }
  if (pendingLogoFetch === id) return;
  pendingLogoFetch = id;
  var type = getItemType(item);
  var fetcher = type === "tv" ? api.getTv(id) : api.getMovie(id);
  fetcher
    .then(function (detail) {
      detailCache[id] = detail;
      if (detail.logo) logoCache[id] = detail.logo;
      pendingLogoFetch = null;
      if (heroEl.getAttribute("data-tmdb-id") !== id) return;
      if (detail.logo) setTitleDisplay(heroEl, item, detail.logo);
      if (detail.certification) {
        var metaEl = heroEl.querySelector(".hero-meta-row");
        if (metaEl) metaEl.innerHTML = buildMetaHtml(item, detail.certification);
      }
      if (onReady) onReady(detail);
    })
    .catch(function () {
      pendingLogoFetch = null;
    });
}

function crossfadeBackdrop(heroEl, backdropUrl) {
  var layerA = heroEl.querySelector(".hero-backdrop-a");
  var layerB = heroEl.querySelector(".hero-backdrop-b");
  if (!layerA || !layerB) return;

  stopHeroTrailer(heroEl);

  var next = activeBackdrop === "a" ? layerB : layerA;
  var prev = activeBackdrop === "a" ? layerA : layerB;

  next.style.opacity = "";
  next.style.transition = "";
  prev.style.opacity = "";
  prev.style.transition = "";

  next.style.backgroundImage = backdropUrl ? "url('" + backdropUrl + "')" : "none";
  next.classList.add("is-active");
  prev.classList.remove("is-active", "ken-burns-active");
  activeBackdrop = activeBackdrop === "a" ? "b" : "a";
  if (backdropUrl && motion.getMotionProfile().kenBurnsMs > 0 && motion.animationsEnabled()) {
    next.classList.add("ken-burns-active");
  }
}

function wireHandlers(heroEl, item, handlers) {
  var playBtn = heroEl.querySelector('[data-action="play"]');
  var infoBtn = heroEl.querySelector('[data-action="info"]');

  if (playBtn) {
    playBtn.onclick = handlers && handlers.onPlay ? function () { handlers.onPlay(item); } : null;
  }
  if (infoBtn) {
    infoBtn.onclick = handlers && handlers.onInfo ? function () { handlers.onInfo(item); } : null;
  }
}

function buildHeroInner(item) {
  var type = getItemType(item);
  var overview = truncate(item.overview || "", 220);
  var logoUrl = logoCache[String(item.id)] || item.logo || null;

  var titleHtml = "";
  if (logoUrl) {
    titleHtml =
      '<img class="hero-logo" src="' +
      escapeHtml(logoUrl) +
      '" alt="' +
      escapeHtml(item.title || "") +
      '">';
  } else {
    titleHtml =
      '<h1 class="hero-title">' + escapeHtml(item.title || item.name || "Untitled") + "</h1>";
  }

  return (
    '<div class="hero-backdrops">' +
    '<div class="hero-backdrop hero-backdrop-a is-active"></div>' +
    '<div class="hero-backdrop hero-backdrop-b"></div>' +
    '<div class="hero-video-bg hidden"></div>' +
    "</div>" +
    '<div class="hero-gradient"></div>' +
    '<div class="hero-content">' +
    '<div class="hero-badge"><span class="hero-n">N</span> ' +
    (type === "tv" ? "SERIES" : "FILM") +
    "</div>" +
    '<div class="hero-title-wrap">' +
    titleHtml +
    "</div>" +
    '<div class="hero-meta-row">' +
    buildMetaHtml(item, detailCache[String(item.id)] && detailCache[String(item.id)].certification) +
    "</div>" +
    '<p class="hero-overview">' +
    escapeHtml(overview) +
    "</p>" +
    '<div class="hero-actions" data-focus-row="hero">' +
    '<button type="button" class="btn btn-play focusable" data-action="play">▶ Play</button>' +
    '<button type="button" class="btn btn-info focusable" data-action="info">More info</button>' +
    "</div>" +
    "</div>"
  );
}

function renderHero(item, handlers) {
  activeBackdrop = "a";
  var el = document.createElement("section");
  el.className = "hero";
  el.setAttribute("data-tmdb-id", String(item.id));
  el.setAttribute("data-media-type", getItemType(item));
  el._heroHandlers = handlers || null;
  el._heroItem = item;

  el.innerHTML = buildHeroInner(item);

  var backdrop = item.backdrop || item.poster || "";
  var layerA = el.querySelector(".hero-backdrop-a");
  if (layerA && backdrop) {
    layerA.style.backgroundImage = "url('" + backdrop + "')";
    if (motion.getMotionProfile().kenBurnsMs > 0 && motion.animationsEnabled()) {
      layerA.classList.add("ken-burns-active");
    }
  }

  wireHandlers(el, item, handlers);
  fetchDetailExtras(item, el);
  return el;
}

function updateHeroText(heroEl, item, callback) {
  var content = heroEl.querySelector(".hero-content");
  if (!content) {
    if (callback) callback();
    return;
  }

  var fadeMs = motion.animationsEnabled() ? motion.getMotionProfile().fadeMs : 0;

  if (fadeMs <= 0) {
    applyHeroText(heroEl, item);
    if (callback) callback();
    return;
  }

  content.classList.add("is-fading");
  setTimeout(function () {
    applyHeroText(heroEl, item);
    content.classList.remove("is-fading");
    if (callback) callback();
  }, fadeMs);
}

function applyHeroText(heroEl, item) {
  var type = getItemType(item);
  var badge = heroEl.querySelector(".hero-badge");
  if (badge) {
    badge.innerHTML =
      '<span class="hero-n">N</span> ' + (type === "tv" ? "SERIES" : "FILM");
  }

  setTitleDisplay(heroEl, item, logoCache[String(item.id)] || item.logo || null);

  var metaEl = heroEl.querySelector(".hero-meta-row");
  if (metaEl) {
    metaEl.innerHTML = buildMetaHtml(
      item,
      detailCache[String(item.id)] && detailCache[String(item.id)].certification
    );
  }

  var overviewEl = heroEl.querySelector(".hero-overview");
  if (overviewEl) overviewEl.textContent = truncate(item.overview || "", 220);

  heroEl.setAttribute("data-tmdb-id", String(item.id));
  heroEl.setAttribute("data-media-type", type);
  heroEl._heroItem = item;

  if (heroEl._heroHandlers) {
    wireHandlers(heroEl, item, heroEl._heroHandlers);
  }

  fetchDetailExtras(item, heroEl, function () {
    scheduleHeroTrailer(heroEl, item);
  });
}

function updateHero(heroEl, item) {
  if (!heroEl || !item) return;
  if (heroEl.getAttribute("data-tmdb-id") === String(item.id)) return;

  if (updateTimer) clearTimeout(updateTimer);
  stopHeroTrailer(heroEl);

  var debounceMs = motion.animationsEnabled() ? motion.getMotionProfile().heroDebounceMs : 0;

  function runUpdate() {
    updateTimer = null;
    var backdrop = item.backdrop || item.poster || "";
    crossfadeBackdrop(heroEl, backdrop);
    updateHeroText(heroEl, item);
  }

  if (debounceMs <= 0) {
    runUpdate();
  } else {
    updateTimer = setTimeout(runUpdate, debounceMs);
  }
}

function resetHeroState() {
  activeBackdrop = "a";
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
  stopHeroTrailer(null);
}

module.exports = {
  renderHero: renderHero,
  updateHero: updateHero,
  resetHeroState: resetHeroState,
  stopHeroTrailer: stopHeroTrailer,
};
