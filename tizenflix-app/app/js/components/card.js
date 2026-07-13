/**
 * Poster card for browse rows.
 */

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

function getProgressPercent(item) {
  if (!item) return 0;
  if (item.percent != null && isFinite(item.percent)) return Math.max(0, Math.min(100, item.percent));
  var dur = item.durationSeconds;
  var pos = item.positionSeconds;
  if (dur > 0 && pos >= 0) return Math.max(0, Math.min(100, (pos / dur) * 100));
  return 0;
}

function formatTimeLeft(seconds) {
  var total = Math.max(0, Math.floor(seconds || 0));
  if (total < 60) return total + "s left";
  var hours = Math.floor(total / 3600);
  var minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return hours + "h " + minutes + "m left";
  return minutes + "m left";
}

function getTimeLeftSeconds(item) {
  if (!item) return 0;
  var dur = item.durationSeconds || 0;
  var pos = item.positionSeconds || 0;
  if (dur > 0) return Math.max(0, dur - pos);
  return 0;
}

function buildEpisodeLine(item) {
  if (!item) return "";
  var type = getItemType(item);
  if (type === "tv" && item.season != null && item.episode != null) {
    var line = "S" + item.season + " E" + item.episode;
    if (item.episodeTitle) line += " • " + item.episodeTitle;
    return line;
  }
  return item.title || item.name || "";
}

function buildProgressHtml(item) {
  var pct = getProgressPercent(item);
  if (pct <= 0) return "";
  return (
    '<div class="card-progress">' +
    '<div class="card-progress-fill" style="width:' +
    pct.toFixed(1) +
    '%"></div>' +
    "</div>"
  );
}

function buildAriaLabel(item) {
  var title = item.title || item.name || "Untitled";
  var type = getItemType(item);
  var typeLabel = type === "tv" ? "TV series" : "Movie";
  var label = title + ", " + typeLabel;
  if (type === "tv" && item.season != null && item.episode != null) {
    label += ", season " + item.season + " episode " + item.episode;
  }
  var left = getTimeLeftSeconds(item);
  if (left > 0) label += ", " + formatTimeLeft(left);
  return label;
}

function buildMetaParts(item, extras) {
  extras = extras || {};
  var parts = [];
  var type = getItemType(item);
  if (extras.genre) parts.push(extras.genre);
  else if (type === "tv") parts.push("TV Series");
  else parts.push("Movie");
  if (item.year) parts.push(String(item.year));
  if (extras.seasons) parts.push(extras.seasons + " Seasons");
  return parts;
}

function buildMetaHtml(item, extras) {
  var parts = buildMetaParts(item, extras);
  var html = "";
  for (var i = 0; i < parts.length; i++) {
    if (i > 0) html += '<span class="spotlight-meta-dot">•</span>';
    html += "<span>" + escapeHtml(parts[i]) + "</span>";
  }
  var cert = extras && extras.certification;
  if (cert) {
    if (parts.length) html += '<span class="spotlight-meta-dot">•</span>';
    html +=
      '<span class="spotlight-rating-badge">' + escapeHtml(cert) + "</span>";
  }
  return html;
}

function buildContinueWatchingDetailHtml(item) {
  return (
    '<p class="card-spotlight-episode-line">' +
    escapeHtml(buildEpisodeLine(item)) +
    "</p>" +
    '<p class="card-spotlight-time-left">' +
    escapeHtml(formatTimeLeft(getTimeLeftSeconds(item))) +
    "</p>"
  );
}

function buildPillsHtml(item) {
  var type = getItemType(item);
  var year = item.year || 0;
  var pills = [];
  if (type === "tv" && year >= 2023) {
    pills.push(
      '<span class="spotlight-pill spotlight-pill-new"><span class="spotlight-pill-icon" aria-hidden="true">▶</span> New Season</span>'
    );
  }
  if (item.rating && item.rating >= 8) {
    pills.push(
      '<span class="spotlight-pill spotlight-pill-award"><span class="spotlight-pill-icon" aria-hidden="true">★</span> Top Rated</span>'
    );
  }
  if (!pills.length) return "";
  return '<div class="card-spotlight-pills">' + pills.join("") + "</div>";
}

function buildBrandHtml(item, logoUrl, compact) {
  var type = getItemType(item);
  var title = item.title || item.name || "Untitled";
  var seriesLabel =
    '<div class="card-spotlight-series"><span class="hero-n">N</span> ' +
    (type === "tv" ? "SERIES" : "FILM") +
    "</div>";

  var titleHtml = "";
  if (logoUrl) {
    titleHtml =
      '<img class="card-spotlight-logo' +
      (compact ? " card-spotlight-logo-compact" : "") +
      '" src="' +
      escapeHtml(logoUrl) +
      '" alt="' +
      escapeHtml(title) +
      '">';
  } else {
    titleHtml =
      '<div class="card-spotlight-title-text' +
      (compact ? " card-spotlight-title-text-compact" : "") +
      '">' +
      escapeHtml(title) +
      "</div>";
  }

  return (
    '<div class="card-spotlight-brand' +
    (compact ? " card-spotlight-brand-compact" : "") +
    '">' +
    seriesLabel +
    titleHtml +
    "</div>"
  );
}

function updateCardProgress(cardEl, item) {
  if (!cardEl || !item) return;
  var poster = cardEl.querySelector(".card-poster");
  if (!poster) return;
  var existing = poster.querySelector(".card-progress");
  var html = buildProgressHtml(item);
  if (!html) {
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    return;
  }
  if (existing) {
    existing.outerHTML = html;
  } else {
    poster.insertAdjacentHTML("beforeend", html);
  }
}

function updateSpotlightCard(cardEl, item, extras, options) {
  if (!cardEl || !item) return;
  options = options || {};
  extras = extras || {};

  var poster = cardEl.querySelector(".card-poster");
  if (poster) {
    var portraitUrl = item.poster || "";
    var backdropUrl = item.backdrop || item.poster || "";
    var portraitLayer = poster.querySelector(".card-poster-portrait");
    var backdropLayer = poster.querySelector(".card-poster-backdrop");
    if (portraitLayer && backdropLayer) {
      if (portraitUrl) {
        portraitLayer.style.backgroundImage = "url('" + portraitUrl.replace(/'/g, "%27") + "')";
      }
      if (cardEl.classList.contains("tv-focus") && backdropUrl) {
        backdropLayer.style.backgroundImage = "url('" + backdropUrl.replace(/'/g, "%27") + "')";
        poster.classList.add("is-backdrop-active");
      } else {
        poster.classList.remove("is-backdrop-active");
      }
    } else {
      var image =
        cardEl.classList.contains("tv-focus")
          ? backdropUrl
          : portraitUrl;
      if (image) poster.style.backgroundImage = "url('" + image.replace(/'/g, "%27") + "')";
    }
  }

  var isCw = options.variant === "continue-watching";
  var brand = cardEl.querySelector(".card-spotlight-brand");
  if (brand) {
    brand.outerHTML = buildBrandHtml(item, extras.logo || null, isCw && !cardEl.classList.contains("tv-focus"));
  }

  if (!isCw) {
    var pills = cardEl.querySelector(".card-spotlight-pills");
    var pillsHtml = buildPillsHtml(item);
    if (pills) {
      if (pillsHtml) pills.outerHTML = pillsHtml;
      else pills.parentNode.removeChild(pills);
    } else if (pillsHtml && poster) {
      poster.insertAdjacentHTML("beforeend", pillsHtml);
    }
  }

  if (isCw) updateCardProgress(cardEl, item);
}

function updateSpotlightDetailPanel(panelEl, item, extras, options) {
  if (!panelEl || !item) return;
  options = options || {};
  extras = extras || {};

  if (options.variant === "continue-watching") {
    panelEl.innerHTML = buildContinueWatchingDetailHtml(item);
    return;
  }

  var metaLine = panelEl.querySelector(".card-spotlight-meta-line");
  var overview = panelEl.querySelector(".card-spotlight-overview");
  if (metaLine) metaLine.innerHTML = buildMetaHtml(item, extras);
  if (overview) overview.textContent = truncate(item.overview || "", 200);
}

function createCard(item, onSelect, options) {
  options = options || {};
  var layout = options.layout || "standard";
  var variant = options.variant || "";
  var type = getItemType(item);
  var title = item.title || item.name || "Untitled";
  var poster = item.poster || "";
  var backdrop = item.backdrop || poster || "";
  var isCw = variant === "continue-watching";

  var el = document.createElement("button");
  el.type = "button";
  el.className = "card focusable";
  if (layout === "spotlight") el.classList.add("card-spotlight");
  if (isCw) el.classList.add("card-continue-watching");
  el.setAttribute("data-tmdb-id", String(item.id));
  el.setAttribute("data-media-type", type);
  el.setAttribute("data-poster", poster || "");
  el.setAttribute("data-backdrop", backdrop || "");
  el.setAttribute("aria-label", buildAriaLabel(item));
  if (isCw && item.season != null) el.setAttribute("data-season", String(item.season));
  if (isCw && item.episode != null) el.setAttribute("data-episode", String(item.episode));

  if (layout === "spotlight") {
    el.innerHTML =
      '<div class="card-spotlight-stack">' +
      '<div class="card-poster">' +
      '<div class="card-poster-portrait" style="background-image:url(\'' +
      escapeHtml(poster) +
      "')\"></div>" +
      '<div class="card-poster-backdrop"></div>' +
      buildBrandHtml(item, null, isCw) +
      (isCw ? "" : buildPillsHtml(item)) +
      (isCw ? buildProgressHtml(item) : "") +
      "</div>" +
      "</div>" +
      '<span class="card-title">' +
      escapeHtml(title) +
      "</span>";
  } else {
    el.innerHTML =
      '<div class="card-poster" style="background-image:url(\'' +
      escapeHtml(poster) +
      "')\">" +
      (isCw ? buildProgressHtml(item) : "") +
      "</div>" +
      '<span class="card-title">' +
      escapeHtml(title) +
      "</span>";
  }

  el.addEventListener("click", function () {
    if (onSelect) onSelect(item);
  });

  return el;
}

module.exports = {
  createCard: createCard,
  updateSpotlightCard: updateSpotlightCard,
  updateSpotlightDetailPanel: updateSpotlightDetailPanel,
  buildMetaHtml: buildMetaHtml,
  buildAriaLabel: buildAriaLabel,
  buildContinueWatchingDetailHtml: buildContinueWatchingDetailHtml,
  buildEpisodeLine: buildEpisodeLine,
  formatTimeLeft: formatTimeLeft,
  getProgressPercent: getProgressPercent,
  truncate: truncate,
};
