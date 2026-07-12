/**
 * Featured hero banner (Netflix-style) — dual-backdrop crossfade + in-place updates.
 */

var api = require("../services/api.js");
var motion = require("../core/motion.js");

var logoCache = {};
var detailCache = {};
var pendingLogoFetch = null;
var activeBackdrop = "a";

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

function fetchDetailExtras(item, heroEl) {
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
    })
    .catch(function () {
      pendingLogoFetch = null;
    });
}

function crossfadeBackdrop(heroEl, backdropUrl) {
  var layerA = heroEl.querySelector(".hero-backdrop-a");
  var layerB = heroEl.querySelector(".hero-backdrop-b");
  if (!layerA || !layerB) return;

  var next = activeBackdrop === "a" ? layerB : layerA;
  var prev = activeBackdrop === "a" ? layerA : layerB;

  next.style.backgroundImage = backdropUrl ? "url('" + backdropUrl + "')" : "none";
  next.classList.add("is-active");
  prev.classList.remove("is-active");
  activeBackdrop = activeBackdrop === "a" ? "b" : "a";
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

  content.classList.add("is-fading");
  var fadeMs = motion.getMotionProfile().fadeMs;
  setTimeout(function () {
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

    content.classList.remove("is-fading");
    fetchDetailExtras(item, heroEl);
    if (callback) callback();
  }, fadeMs);
}

var updateTimer = null;

function updateHero(heroEl, item) {
  if (!heroEl || !item) return;
  if (heroEl.getAttribute("data-tmdb-id") === String(item.id)) return;

  if (updateTimer) clearTimeout(updateTimer);
  var debounceMs = motion.getMotionProfile().heroDebounceMs;
  updateTimer = setTimeout(function () {
    updateTimer = null;
    var backdrop = item.backdrop || item.poster || "";
    crossfadeBackdrop(heroEl, backdrop);
    updateHeroText(heroEl, item);
  }, debounceMs);
}

function resetHeroState() {
  activeBackdrop = "a";
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
}

module.exports = {
  renderHero: renderHero,
  updateHero: updateHero,
  resetHeroState: resetHeroState,
};
