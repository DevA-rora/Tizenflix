/**
 * Poster card tile (stub).
 */

function create(item) {
  var card = document.createElement("button");
  card.type = "button";
  card.className = "content-card";
  card.setAttribute("data-tmdb-id", item.tmdbId || "");
  card.setAttribute("data-media-type", item.mediaType || "movie");
  card.textContent = item.title || "Title";
  return card;
}

module.exports = {
  create: create,
};
