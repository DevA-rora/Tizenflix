/**
 * Featured hero banner (Netflix-style).
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

function renderHero(item, handlers) {
  var type = item.type || item.mediaType || item.media_type || "movie";
  var badge = type === "tv" ? "N SERIES" : "FILM";
  var backdrop = item.backdrop || "";
  var title = item.title || item.name || "Untitled";
  var overview = truncate(item.overview || "", 220);
  var rank = item.rank ? "#" + item.rank + " in " + (type === "tv" ? "TV Shows" : "Movies") + " Today" : "";

  var el = document.createElement("section");
  el.className = "hero";
  el.setAttribute("data-tmdb-id", String(item.id));
  el.setAttribute("data-media-type", type);

  el.innerHTML =
    '<div class="hero-backdrop" style="background-image:url(\'' +
    escapeHtml(backdrop) +
    '\')"></div>' +
    '<div class="hero-gradient"></div>' +
    '<div class="hero-content">' +
    '<div class="hero-badge"><span class="hero-n">N</span> ' +
    (type === "tv" ? "SERIES" : "FILM") +
    "</div>" +
    '<h1 class="hero-title">' +
    escapeHtml(title) +
    "</h1>" +
    (rank ? '<div class="hero-rank"><span class="top10">TOP 10</span> ' + escapeHtml(rank) + "</div>" : "") +
    '<p class="hero-overview">' +
    escapeHtml(overview) +
    "</p>" +
    '<div class="hero-actions">' +
    '<button type="button" class="btn btn-play focusable" data-action="play">▶ Play</button>' +
    '<button type="button" class="btn btn-info focusable" data-action="info">More info</button>' +
    "</div>" +
    "</div>";

  var playBtn = el.querySelector('[data-action="play"]');
  var infoBtn = el.querySelector('[data-action="info"]');

  if (playBtn && handlers && handlers.onPlay) {
    playBtn.addEventListener("click", function () {
      handlers.onPlay(item);
    });
  }
  if (infoBtn && handlers && handlers.onInfo) {
    infoBtn.addEventListener("click", function () {
      handlers.onInfo(item);
    });
  }

  return el;
}

module.exports = {
  renderHero: renderHero,
};
