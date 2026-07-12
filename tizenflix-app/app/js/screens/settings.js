/**
 * Settings screen (stub) — quality, API URL, subtitles later.
 */

var config = require("../core/config.js");

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-settings";
  el.innerHTML =
    '<div class="screen-placeholder">' +
    "<h2>Settings</h2>" +
    "<p>API URL, quality mode, subtitles, and advanced options will live here.</p>" +
    "<p>Quality: <strong>" +
    config.getQualityMode() +
    "</strong></p>" +
    "</div>";
  container.appendChild(el);
}

module.exports = {
  render: render,
};
