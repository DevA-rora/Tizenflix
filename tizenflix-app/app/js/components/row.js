/**
 * Horizontal content row — standard and spotlight layouts.
 */

var card = require("./card.js");
var api = require("../services/api.js");
var motion = require("../core/motion.js");

var rowCounter = 0;
var spotlightDetailCache = {};

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

function syncSpotlightDetailPosition(row) {
  var focused = row.querySelector(".card.tv-focus");
  var panel = row.querySelector(".row-spotlight-detail");
  var body = row.querySelector(".row-spotlight-body");
  if (!focused || !panel || !body) return;
  var bodyRect = body.getBoundingClientRect();
  var cardRect = focused.getBoundingClientRect();
  panel.style.paddingLeft = Math.max(0, Math.round(cardRect.left - bodyRect.left)) + "px";
}

function syncSpotlightLayout(row) {
  syncSpotlightDescribedBy(row);
  syncSpotlightDetailPosition(row);
}

function updateSpotlightMeta(row, item) {
  if (!row || !item) return;
  var focused = row.querySelector(".card.tv-focus");
  var panel = row.querySelector(".row-spotlight-detail");
  if (!focused || !panel) return;

  var id = String(item.id);
  var extras = spotlightDetailCache[id] || {};

  panel.classList.add("is-fading");
  var fadeMs = motion.getMotionProfile().fadeMs;
  setTimeout(function () {
    card.updateSpotlightCard(focused, item, extras);
    card.updateSpotlightDetailPanel(panel, item, extras);
    panel.classList.remove("is-fading");
    syncSpotlightDescribedBy(row);
  }, fadeMs);

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
        card.updateSpotlightCard(current, item, cached);
        card.updateSpotlightDetailPanel(panel, item, cached);
      }
    })
    .catch(function () {
      /* keep basic metadata */
    });
}

function createRow(title, items, onSelect, options) {
  options = options || {};
  var layout = options.layout || "standard";

  rowCounter += 1;
  var rowId = "row-" + rowCounter;
  var row = document.createElement("section");
  row.className = "content-row row-enter";
  row.classList.add("row-" + layout);
  row.setAttribute("data-focus-row", rowId);
  row.setAttribute("data-row-layout", layout);

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

    for (var i = 0; i < items.length; i++) {
      track.appendChild(card.createCard(items[i], onSelect, { layout: layout }));
    }

    trackOuter.appendChild(track);
    body.appendChild(trackOuter);
    initTrackScroll(track);

    var detailId = "spotlight-detail-" + rowId;
    var detailPanel = document.createElement("div");
    detailPanel.className = "row-spotlight-detail";
    detailPanel.id = detailId;
    var first = items[0];
    detailPanel.innerHTML =
      '<p class="card-spotlight-meta-line">' +
      card.buildMetaHtml(first, {}) +
      "</p>" +
      '<p class="card-spotlight-overview">' +
      escapeHtml(truncate(first.overview || "", 200)) +
      "</p>";
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
      standardTrack.appendChild(card.createCard(items[j], onSelect, { layout: layout }));
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
}

module.exports = {
  createRow: createRow,
  resetRowCounter: resetRowCounter,
  updateSpotlightMeta: updateSpotlightMeta,
};
