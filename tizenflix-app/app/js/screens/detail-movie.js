/**
 * Movie detail screen (stub).
 */

var params = {};

function onEnter(p) {
  params = p || {};
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-detail-movie";
  el.innerHTML =
    '<div class="screen-placeholder">' +
    "<h2>Movie</h2>" +
    "<p>TMDB ID: " + (params.tmdbId || "—") + "</p>" +
    "<p>Poster, synopsis, and Play button will render here.</p>" +
    "</div>";
  container.appendChild(el);
}

module.exports = {
  onEnter: onEnter,
  render: render,
};
