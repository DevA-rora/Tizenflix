/**
 * TV series detail — seasons and episodes (stub).
 */

var params = {};

function onEnter(p) {
  params = p || {};
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-detail-tv";
  el.innerHTML =
    '<div class="screen-placeholder">' +
    "<h2>TV Series</h2>" +
    "<p>TMDB ID: " + (params.tmdbId || "—") + "</p>" +
    "<p>Season and episode picker will render here.</p>" +
    "</div>";
  container.appendChild(el);
}

module.exports = {
  onEnter: onEnter,
  render: render,
};
