/**
 * Categories — browse by genre (placeholder until genre rows are wired).
 */

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-categories";
  el.innerHTML =
    '<div class="loading-msg" style="padding:48px">' +
    "<h2>Categories</h2>" +
    "<p>Browse by genre — coming soon.</p>" +
    "</div>";
  container.appendChild(el);
}

module.exports = {
  render: render,
};
