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

function createCard(item, onSelect) {
  var type = item.type || item.mediaType || item.media_type || "movie";
  var title = item.title || item.name || "Untitled";
  var poster = item.poster || "";

  var el = document.createElement("button");
  el.type = "button";
  el.className = "card focusable";
  el.setAttribute("data-tmdb-id", String(item.id));
  el.setAttribute("data-media-type", type);
  el.setAttribute("aria-label", title);

  el.innerHTML =
    '<div class="card-poster" style="background-image:url(\'' +
    escapeHtml(poster) +
    '\')">' +
    "</div>" +
    '<span class="card-title">' +
    escapeHtml(title) +
    "</span>";

  el.addEventListener("click", function () {
    if (onSelect) onSelect(item);
  });

  return el;
}

module.exports = {
  createCard: createCard,
};
