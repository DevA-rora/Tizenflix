/**
 * Settings — API URL, playback prefs, providers, gate link.
 */

var api = require("../services/api.js");
var config = require("../core/config.js");
var focus = require("../core/focus.js");

function applyDevModeFromSettings(enabled) {
  config.setDevMode(enabled);
  if (document.body) {
    document.body.classList.toggle("dev-mode-on", enabled);
    document.body.classList.toggle("dev-mode-off", !enabled);
  }
}

function renderProviderManager(container, onBack) {
  container.innerHTML =
    '<div class="screen screen-settings">' +
    "<h2>Stream providers</h2>" +
    '<p class="settings-hint">Toggle scraper providers (saved on API server).</p>' +
    '<div id="providerList" class="settings-provider-list loading-msg">Loading…</div>' +
    '<button type="button" id="providersBackBtn" class="btn btn-info focusable">Back</button>' +
    "</div>";

  var listEl = container.querySelector("#providerList");
  var backBtn = container.querySelector("#providersBackBtn");
  backBtn.addEventListener("click", onBack);

  api
    .getStreamflixProviders()
    .then(function (data) {
      var providers = data.providers || [];
      var html = "";
      for (var i = 0; i < providers.length; i++) {
        var p = providers[i];
        if (p.implementationStatus === "stub") continue;
        var health = p.health;
        var healthTxt = health
          ? " (" + health.successes + " ok / " + health.failures + " fail)"
          : "";
        html +=
          '<div class="settings-field" data-focus-row="prov-' +
          i +
          '">' +
          '<button type="button" class="btn btn-info focusable provider-toggle" data-id="' +
          p.id +
          '" data-enabled="' +
          (p.enabled ? "1" : "0") +
          '">' +
          (p.enabled ? "ON" : "OFF") +
          " — " +
          p.name +
          " [" +
          p.language +
          "]" +
          healthTxt +
          "</button></div>";
      }
      listEl.className = "settings-provider-list";
      listEl.innerHTML = html || "<p>No providers</p>";

      var toggles = listEl.querySelectorAll(".provider-toggle");
      for (var t = 0; t < toggles.length; t++) {
        toggles[t].addEventListener("click", function () {
          var btn = this;
          var id = btn.getAttribute("data-id");
          var enabled = btn.getAttribute("data-enabled") !== "1";
          api.toggleStreamflixProvider(id, enabled).then(function () {
            btn.setAttribute("data-enabled", enabled ? "1" : "0");
            btn.textContent =
              (enabled ? "ON" : "OFF") +
              btn.textContent.substring(btn.textContent.indexOf(" —"));
          });
        });
      }
      focus.refresh(container);
    })
    .catch(function (err) {
      listEl.textContent = "Failed: " + err.message;
    });
}

function render(container) {
  var devOn = config.getDevMode();
  var gridScale = config.getGridScale();
  var autoplay = config.getAutoplayNext();
  var bufferSec = config.getAutoplayBufferSec();
  var extraBuf = config.getExtraBuffering();
  var catalogLang = config.getCatalogLang();
  var audioPref = config.getAudioPref();
  var uiAnimations = config.getUiAnimations();
  var targetRes = config.getTargetResolution();

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
    "</div>" +
    '<div class="settings-field settings-toggle" data-focus-row="settings-anim">' +
    '<button type="button" id="uiAnimBtn" class="btn btn-info focusable">TV animation effects: ' +
    (uiAnimations ? "ON" : "OFF") +
    "</button>" +
    "</div>" +
    '<div class="settings-field" data-focus-row="settings-grid">' +
    '<label for="gridScaleInput">Grid size: ' +
    gridScale +
    "%</label>" +
    '<input type="range" id="gridScaleInput" class="focusable" min="70" max="130" value="' +
    gridScale +
    '" />' +
    "</div>" +
    '<div class="settings-field" data-focus-row="settings-lang">' +
    '<label for="catalogLangInput">Catalog language</label>' +
    '<select id="catalogLangInput" class="focusable">' +
    '<option value="en"' +
    (catalogLang === "en" ? " selected" : "") +
    ">English</option>" +
    '<option value="de"' +
    (catalogLang === "de" ? " selected" : "") +
    ">German</option>" +
    '<option value="fr"' +
    (catalogLang === "fr" ? " selected" : "") +
    ">French</option>" +
    '<option value="it"' +
    (catalogLang === "it" ? " selected" : "") +
    ">Italian</option>" +
    '<option value="es"' +
    (catalogLang === "es" ? " selected" : "") +
    ">Spanish</option>" +
    "</select></div>" +
    '<div class="settings-field" data-focus-row="settings-audio">' +
    '<label for="audioPrefInput">Audio / dubbing</label>' +
    '<select id="audioPrefInput" class="focusable">' +
    '<option value="original"' +
    (audioPref === "original" ? " selected" : "") +
    ">Original voice acting</option>" +
    '<option value="en"' +
    (audioPref === "en" ? " selected" : "") +
    ">English</option>" +
    '<option value="de"' +
    (audioPref === "de" ? " selected" : "") +
    ">German</option>" +
    '<option value="fr"' +
    (audioPref === "fr" ? " selected" : "") +
    ">French</option>" +
    '<option value="it"' +
    (audioPref === "it" ? " selected" : "") +
    ">Italian</option>" +
    '<option value="es"' +
    (audioPref === "es" ? " selected" : "") +
    ">Spanish</option>" +
    '<option value="ja"' +
    (audioPref === "ja" ? " selected" : "") +
    ">Japanese</option>" +
    '<option value="ko"' +
    (audioPref === "ko" ? " selected" : "") +
    ">Korean</option>" +
    '<option value="zh"' +
    (audioPref === "zh" ? " selected" : "") +
    ">Chinese</option>" +
    "</select>" +
    '<p class="settings-hint">Original uses each title\'s native language. Some sources may not report audio language and will play with a warning.</p></div>' +
    '<div class="settings-field" data-focus-row="settings-autoplay">' +
    '<button type="button" id="autoplayBtn" class="btn btn-info focusable">Autoplay next: ' +
    (autoplay ? "ON" : "OFF") +
    "</button>" +
    '<label for="autoplayBufferInput">Countdown (sec): ' +
    bufferSec +
    "</label>" +
    '<input type="range" id="autoplayBufferInput" class="focusable" min="0" max="15" value="' +
    bufferSec +
    '" />' +
    "</div>" +
    '<div class="settings-field" data-focus-row="settings-buffer">' +
    '<button type="button" id="extraBufferBtn" class="btn btn-info focusable">Extra buffering: ' +
    (extraBuf ? "ON" : "OFF") +
    "</button></div>" +
    '<div class="settings-field" data-focus-row="settings-resolution">' +
    '<label for="targetResolutionInput">Default stream quality</label>' +
    '<select id="targetResolutionInput" class="focusable">' +
    '<option value="auto"' +
    (targetRes === "auto" ? " selected" : "") +
    ">Auto</option>" +
    '<option value="720"' +
    (targetRes === "720" ? " selected" : "") +
    ">720p</option>" +
    '<option value="1080"' +
    (targetRes === "1080" ? " selected" : "") +
    ">1080p</option>" +
    '<option value="2160"' +
    (targetRes === "2160" ? " selected" : "") +
    ">4K</option>" +
    "</select>" +
    '<p class="settings-hint">Auto starts on the lowest rung and ramps up. Locked modes prefer matching sources. Quality depends on what each server offers; 4K may buffer heavily on some TVs.</p></div>' +
    '<p class="settings-hint">Play backend: <strong>' +
    config.getPlayBackend() +
    '</strong> <button type="button" id="backendCycleBtn" class="btn btn-info focusable">Cycle</button></p>' +
    '<p class="settings-hint">auto = Videasy CDN → VixSrc → Streamflix → embeds → Vidking. videasy / vidking / streamflix force one engine.</p>' +
    '<button type="button" id="providersBtn" class="btn btn-info focusable">Manage providers</button>' +
    '<p class="settings-hint">Gate test: <a href="gate/index.html">gate/index.html</a></p>';
  container.appendChild(el);

  var input = el.querySelector("#apiBaseInput");
  var saveBtn = el.querySelector("#saveApiBtn");
  var devBtn = el.querySelector("#devModeBtn");
  var uiAnimBtn = el.querySelector("#uiAnimBtn");
  var backendBtn = el.querySelector("#backendCycleBtn");
  var gridInput = el.querySelector("#gridScaleInput");
  var langInput = el.querySelector("#catalogLangInput");
  var audioPrefInput = el.querySelector("#audioPrefInput");
  var autoplayBtn = el.querySelector("#autoplayBtn");
  var bufferInput = el.querySelector("#autoplayBufferInput");
  var extraBtn = el.querySelector("#extraBufferBtn");
  var targetResInput = el.querySelector("#targetResolutionInput");
  var providersBtn = el.querySelector("#providersBtn");
  var status = el.querySelector("#settingsStatus");

  if (gridInput) {
    gridInput.addEventListener("input", function () {
      var v = config.setGridScale(parseInt(gridInput.value, 10));
      gridInput.previousElementSibling.textContent = "Grid size: " + v + "%";
    });
  }

  if (langInput) {
    langInput.addEventListener("change", function () {
      config.setCatalogLang(langInput.value);
    });
  }

  if (audioPrefInput) {
    audioPrefInput.addEventListener("change", function () {
      config.setAudioPref(audioPrefInput.value);
    });
  }

  if (autoplayBtn) {
    autoplayBtn.addEventListener("click", function () {
      var next = !config.getAutoplayNext();
      config.setAutoplayNext(next);
      autoplayBtn.textContent = "Autoplay next: " + (next ? "ON" : "OFF");
    });
  }

  if (bufferInput) {
    bufferInput.addEventListener("input", function () {
      var v = config.setAutoplayBufferSec(parseInt(bufferInput.value, 10));
      bufferInput.previousElementSibling.textContent = "Countdown (sec): " + v;
    });
  }

  if (extraBtn) {
    extraBtn.addEventListener("click", function () {
      var next = !config.getExtraBuffering();
      config.setExtraBuffering(next);
      extraBtn.textContent = "Extra buffering: " + (next ? "ON" : "OFF");
    });
  }

  if (targetResInput) {
    targetResInput.addEventListener("change", function () {
      config.setTargetResolution(targetResInput.value);
    });
  }

  if (providersBtn) {
    providersBtn.addEventListener("click", function () {
      container.innerHTML = "";
      renderProviderManager(container, function () {
        container.innerHTML = "";
        render(container);
        focus.refresh(container);
      });
      focus.refresh(container);
    });
  }

  if (backendBtn) {
    backendBtn.addEventListener("click", function () {
      var order = ["auto", "videasy", "vidking", "streamflix"];
      var current = config.getPlayBackend();
      var idx = order.indexOf(current);
      var next = order[(idx + 1) % order.length];
      config.setPlayBackend(next);
      backendBtn.parentNode.querySelector("strong").textContent = next;
    });
  }

  devBtn.addEventListener("click", function () {
    var next = !config.getDevMode();
    applyDevModeFromSettings(next);
    devBtn.textContent = "Dev mode: " + (next ? "ON" : "OFF");
  });

  if (uiAnimBtn) {
    uiAnimBtn.addEventListener("click", function () {
      var next = !config.getUiAnimations();
      config.setUiAnimations(next);
      var motion = require("../core/motion.js");
      motion.applyBodyClass();
      uiAnimBtn.textContent = "TV animation effects: " + (next ? "ON" : "OFF");
    });
  }

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
