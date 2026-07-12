/**
 * My List — placeholder until watchlist storage exists.
 */

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-mylist";
  el.innerHTML =
    '<div class="loading-msg" style="padding:48px">' +
    "<h2>My List</h2>" +
    "<p>Your saved titles will appear here.</p>" +
    "</div>";
  container.appendChild(el);
}

module.exports = {
  render: render,
};
