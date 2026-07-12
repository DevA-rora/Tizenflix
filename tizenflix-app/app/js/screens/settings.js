/**
 * Settings — API URL, quality mode, gate link.
 */

var api = require("../services/api.js");
var config = require("../core/config.js");

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-settings";
  el.innerHTML =
    "<h2>Settings</h2>" +
    '<div class="settings-field">' +
    '<label for="apiBaseInput">API URL</label>' +
    '<input type="text" id="apiBaseInput" class="focusable" value="' +
    (api.getBase() || "") +
    '" />' +
    "</div>" +
    '<button type="button" id="saveApiBtn" class="btn btn-play focusable">Save &amp; test</button>' +
    '<p id="settingsStatus" class="loading-msg"></p>' +
    '<p class="settings-hint">Quality: <strong>' +
    config.getQualityMode() +
    "</strong> (adaptive)</p>" +
    '<p class="settings-hint">Gate test: <a href="gate/index.html">gate/index.html</a></p>' +
    '<p class="settings-hint">Browser dev: use <code>http://localhost:8790</code> if the API runs on this PC.</p>';
  container.appendChild(el);

  var input = el.querySelector("#apiBaseInput");
  var saveBtn = el.querySelector("#saveApiBtn");
  var status = el.querySelector("#settingsStatus");

  saveBtn.addEventListener("click", function () {
    var url = (input.value || "").trim().replace(/\/$/, "");
    if (!url) {
      status.textContent = "Enter an API URL.";
      return;
    }
    api.setBase(url);
    status.textContent = "Testing…";
    api
      .health()
      .then(function (h) {
        status.textContent = "API OK — " + (h.service || "tizenflix-api");
        if (window.TizenflixApp) window.TizenflixApp.showStatus("API connected", false);
      })
      .catch(function (err) {
        status.textContent = "API unreachable: " + err.message;
      });
  });
}

module.exports = {
  render: render,
};
