/**
 * Home screen — browse rows (stub for Phase 1 UI).
 */

function onEnter() {
  /* load browse rows from API */
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-home";
  el.innerHTML =
    '<div class="screen-placeholder">' +
    "<h2>Home</h2>" +
    "<p>Browse rows and hero banner will render here.</p>" +
    '<p class="app-footer-hint">Gate test: <a href="gate/index.html">gate/index.html</a></p>' +
    "</div>";
  container.appendChild(el);
}

module.exports = {
  onEnter: onEnter,
  render: render,
};
