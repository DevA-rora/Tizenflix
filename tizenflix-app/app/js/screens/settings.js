/**
 * Settings — API URL, quality mode, gate link.
 */

var api = require("../services/api.js");
var config = require("../core/config.js");

function applyDevModeFromSettings(enabled) {
  config.setDevMode(enabled);
  if (document.body) {
    document.body.classList.toggle("dev-mode-on", enabled);
    document.body.classList.toggle("dev-mode-off", !enabled);
  }
}

function render(container) {
  var devOn = config.getDevMode();
  var el = document.createElement("div");
  el.className = "screen screen-settings";
  el.innerHTML =
    "<h2>Settings</h2>" +
    '<div class="settings-field" data-focus-row="settings-api">' +
    '<label for="apiBaseInput">API URL</label>' +
    '<input type="text" id="apiBaseInput" class="focusable" value="' +
    (api.getBase() || "") +
    '" />' +
    "</div>" +
    '<div data-focus-row="settings-save">' +
    '<button type="button" id="saveApiBtn" class="btn btn-play focusable">Save &amp; test</button>' +
    '<p id="settingsStatus" class="loading-msg"></p>' +
    "</div>" +
    '<div class="settings-field settings-toggle" data-focus-row="settings-dev">' +
    '<button type="button" id="devModeBtn" class="btn btn-info focusable">Dev mode: ' +
    (devOn ? "ON" : "OFF") +
    "</button>" +
    '<p class="settings-hint">Dev mode shows focus hints and the debug log overlay.</p>' +
    "</div>" +
    '<p class="settings-hint">Quality: <strong>' +
    config.getQualityMode() +
    "</strong> (adaptive)</p>" +
    '<p class="settings-hint">Gate test: <a href="gate/index.html">gate/index.html</a></p>' +
    '<p class="settings-hint">Browser dev: use <code>http://localhost:8790</code> if the API runs on this PC.</p>';
  container.appendChild(el);

  var input = el.querySelector("#apiBaseInput");
  var saveBtn = el.querySelector("#saveApiBtn");
  var devBtn = el.querySelector("#devModeBtn");
  var status = el.querySelector("#settingsStatus");

  devBtn.addEventListener("click", function () {
    var next = !config.getDevMode();
    applyDevModeFromSettings(next);
    devBtn.textContent = "Dev mode: " + (next ? "ON" : "OFF");
  });

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
