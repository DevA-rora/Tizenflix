/**
 * Horizontal content row — standard and spotlight layouts.
 */

var card = require("./card.js");
var api = require("../services/api.js");
var motion = require("../core/motion.js");

var rowCounter = 0;
var spotlightDetailCache = {};
var episodeTitleCache = {};

function truncate(text, max) {
  return card.truncate(text, max);
}

function syncSpotlightDescribedBy(row) {
  var panel = row.querySelector(".row-spotlight-detail");
  var focused = row.querySelector(".card.tv-focus");
  if (!panel || !focused) return;
  var panelId = panel.id;
  if (panelId) focused.setAttribute("aria-describedby", panelId);
}

var SPOTLIGHT_MIN_TEXT_WIDTH = 360;
var SPOTLIGHT_PANEL_PADDING_RIGHT = 48;
var SPOTLIGHT_TRACK_OUTER_PADDING = 4;

function clearSpotlightDetailPadding(row) {
  var panel = row ? row.querySelector(".row-spotlight-detail") : null;
  if (panel) panel.style.paddingLeft = "";
}

function syncSpotlightDetailPosition(row) {
  var focused = row.querySelector(".card.tv-focus");
  var panel = row.querySelector(".row-spotlight-detail");
  var body = row.querySelector(".row-spotlight-body");
  if (!panel || !body) return;

  if (!row.classList.contains("is-active") || !focused) {
    clearSpotlightDetailPadding(row);
    return;
  }

  var track = row.querySelector(".row-track");
  var scrollX = track && typeof track._scrollX === "number" ? track._scrollX : 0;
  var offset = focused.offsetLeft - scrollX + SPOTLIGHT_TRACK_OUTER_PADDING;

  var bodyWidth = body.clientWidth;
  if (bodyWidth < 1) {
    var bodyRect = body.getBoundingClientRect();
    bodyWidth = bodyRect.width;
  }

  var maxPadding = Math.max(0, bodyWidth - SPOTLIGHT_MIN_TEXT_WIDTH - SPOTLIGHT_PANEL_PADDING_RIGHT);
  offset = Math.max(0, Math.min(Math.round(offset), maxPadding));

  if (offset < 1 && focused.getBoundingClientRect) {
    var cardRect = focused.getBoundingClientRect();
    var measured = Math.round(cardRect.left - body.getBoundingClientRect().left);
    offset = Math.max(0, Math.min(measured, maxPadding));
  }

  panel.style.paddingLeft = offset + "px";
}

function syncSpotlightLayout(row) {
  syncSpotlightDescribedBy(row);
  syncSpotlightDetailPosition(row);
}

function getRowVariant(row) {
  return row.getAttribute("data-row-variant") || "";
}

function fetchEpisodeTitle(item) {
  if (!item || item.type !== "tv" || item.season == null || item.episode == null) {
    return Promise.resolve(null);
  }
  var cacheKey = item.id + ":" + item.season + ":" + item.episode;
  if (episodeTitleCache[cacheKey]) {
    return Promise.resolve(episodeTitleCache[cacheKey]);
  }
  return api
    .getEpisodes(item.id, item.season)
    .then(function (data) {
      var episodes = data.episodes || data.items || [];
      for (var i = 0; i < episodes.length; i++) {
        if (Number(episodes[i].episode) === Number(item.episode)) {
          var name = episodes[i].title || episodes[i].name || "";
          if (name) episodeTitleCache[cacheKey] = name;
          return name || null;
        }
      }
      return null;
    })
    .catch(function () {
      return null;
    });
}

function updateSpotlightMeta(row, item) {
  if (!row || !item) return;
  var focused = row.querySelector(".card.tv-focus");
  var panel = row.querySelector(".row-spotlight-detail");
  if (!focused || !panel) return;

  var variant = getRowVariant(row);
  var id = String(item.id);
  var extras = spotlightDetailCache[id] || {};
  var cardOptions = { variant: variant };

  panel.classList.add("is-fading");
  var fadeMs = motion.getMotionProfile().fadeMs;
  setTimeout(function () {
    card.updateSpotlightCard(focused, item, extras, cardOptions);
    card.updateSpotlightDetailPanel(panel, item, extras, cardOptions);
    panel.classList.remove("is-fading");
    syncSpotlightLayout(row);
  }, fadeMs);

  if (variant === "continue-watching") {
    if (!item.episodeTitle && item.type === "tv") {
      fetchEpisodeTitle(item).then(function (episodeTitle) {
        if (!episodeTitle) return;
        item.episodeTitle = episodeTitle;
        var current = row.querySelector(".card.tv-focus");
        if (current && current.getAttribute("data-tmdb-id") === id) {
          card.updateSpotlightCard(current, item, extras, cardOptions);
          card.updateSpotlightDetailPanel(panel, item, extras, cardOptions);
        }
      });
    }
    return;
  }

  if (spotlightDetailCache[id]) return;

  var type = item.type || item.mediaType || item.media_type || "movie";
  var fetcher = type === "tv" ? api.getTv(id) : api.getMovie(id);
  fetcher
    .then(function (detail) {
      var cached = {
        certification: detail.certification || null,
        logo: detail.logo || null,
        genre: detail.genres && detail.genres.length ? detail.genres[0] : null,
        seasons: detail.numberOfSeasons || null,
      };
      spotlightDetailCache[id] = cached;
      var current = row.querySelector(".card.tv-focus");
      if (current && current.getAttribute("data-tmdb-id") === id) {
        card.updateSpotlightCard(current, item, cached, cardOptions);
        card.updateSpotlightDetailPanel(panel, item, cached, cardOptions);
      }
    })
    .catch(function () {
      /* keep basic metadata */
    });
}

function buildSpotlightDetailHtml(first, variant) {
  if (variant === "continue-watching") {
    return card.buildContinueWatchingDetailHtml(first);
  }
  return (
    '<p class="card-spotlight-meta-line">' +
    card.buildMetaHtml(first, {}) +
    "</p>" +
    '<p class="card-spotlight-overview">' +
    escapeHtml(truncate(first.overview || "", 200)) +
    "</p>"
  );
}

function createRow(title, items, onSelect, options) {
  options = options || {};
  var layout = options.layout || "standard";
  var variant = options.variant || "";

  rowCounter += 1;
  var rowId = "row-" + rowCounter;
  var row = document.createElement("section");
  row.className = "content-row row-enter";
  row.classList.add("row-" + layout);
  row.setAttribute("data-focus-row", rowId);
  row.setAttribute("data-row-layout", layout);
  if (variant) {
    row.setAttribute("data-row-variant", variant);
    if (variant === "continue-watching") row.classList.add("row-continue-watching");
  }

  var heading = document.createElement("h2");
  heading.className = "row-title";
  heading.textContent = title;
  row.appendChild(heading);

  if (layout === "spotlight") {
    var body = document.createElement("div");
    body.className = "row-spotlight-body";

    var trackOuter = document.createElement("div");
    trackOuter.className = "row-track-outer";
    var track = document.createElement("div");
    track.className = "row-track row-spotlight-track";

    var cardOptions = { layout: layout };
    if (variant) cardOptions.variant = variant;

    for (var i = 0; i < items.length; i++) {
      track.appendChild(card.createCard(items[i], onSelect, cardOptions));
    }

    trackOuter.appendChild(track);
    body.appendChild(trackOuter);
    initTrackScroll(track);

    var detailId = "spotlight-detail-" + rowId;
    var detailPanel = document.createElement("div");
    detailPanel.className = "row-spotlight-detail";
    detailPanel.id = detailId;
    var first = items[0];
    detailPanel.innerHTML = buildSpotlightDetailHtml(first, variant);
    body.appendChild(detailPanel);

    row.appendChild(body);

    row._updateSpotlightMeta = function (item) {
      updateSpotlightMeta(row, item);
    };
    row._syncSpotlightLayout = function () {
      syncSpotlightLayout(row);
    };
  } else {
    var standardOuter = document.createElement("div");
    standardOuter.className = "row-track-outer";
    var standardTrack = document.createElement("div");
    standardTrack.className = "row-track";

    for (var j = 0; j < items.length; j++) {
      var standardCardOptions = { layout: layout };
      if (variant) standardCardOptions.variant = variant;
      standardTrack.appendChild(card.createCard(items[j], onSelect, standardCardOptions));
    }

    standardOuter.appendChild(standardTrack);
    row.appendChild(standardOuter);
    initTrackScroll(standardTrack);
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      row.classList.remove("row-enter");
    });
  });

  return row;
}

function initTrackScroll(track) {
  if (!track) return;
  track._scrollX = 0;
  track.style.webkitTransform = "translate3d(0, 0, 0)";
  track.style.transform = "translate3d(0, 0, 0)";
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resetRowCounter() {
  rowCounter = 0;
  spotlightDetailCache = {};
  episodeTitleCache = {};
}

module.exports = {
  createRow: createRow,
  resetRowCounter: resetRowCounter,
  updateSpotlightMeta: updateSpotlightMeta,
};
