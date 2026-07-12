/**
 * Search screen (stub).
 */

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-search";
  el.innerHTML =
    '<div class="screen-placeholder">' +
    "<h2>Search</h2>" +
    "<p>Search input and results grid will render here.</p>" +
    "</div>";
  container.appendChild(el);
}

module.exports = {
  render: render,
};
