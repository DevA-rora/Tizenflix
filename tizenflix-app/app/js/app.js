/**
 * Tizenflix app entry — bootstrap router and global handlers.
 */

var router = require("./core/router.js");
var focus = require("./core/focus.js");
var debug = require("./core/debug.js");
var player = require("./player/player.js");

var home = require("./screens/home.js");
var search = require("./screens/search.js");
var settings = require("./screens/settings.js");
var detailMovie = require("./screens/detail-movie.js");
var detailTv = require("./screens/detail-tv.js");
var playerScreen = require("./screens/player.js");

function updateFocusHint(label) {
  var el = document.getElementById("focusHint");
  if (el) el.textContent = "Focused: " + label;
}

function wireNav() {
  var nav = document.getElementById("appNav");
  if (!nav) return;
  nav.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    var screen = btn.getAttribute("data-screen");
    if (!screen) return;
    router.navigate(screen);
    var links = nav.querySelectorAll("button");
    for (var i = 0; i < links.length; i++) {
      links[i].classList.remove("nav-active");
    }
    btn.classList.add("nav-active");
  });
}

function wireGlobalKeys() {
  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 10009 || e.key === "Back") {
      if (!document.body.classList.contains("is-playing")) {
        router.back();
      }
    }
    if (player.isMediaPlayPauseKey(e)) {
      var video = document.getElementById("video");
      if (video) player.togglePlayPause(video);
    }
  });
}

function init() {
  debug.debugClear();
  debug.debugLog("Tizenflix app — Tizen TV: " + (player.isTizenTv() ? "yes" : "no"));

  router.register("home", home);
  router.register("search", search);
  router.register("settings", settings);
  router.register("detail-movie", detailMovie);
  router.register("detail-tv", detailTv);
  router.register("player", playerScreen);

  router.init({
    root: document.getElementById("appRoot"),
    initial: "home",
    onFocusHint: updateFocusHint,
  });

  wireNav();
  wireGlobalKeys();
  focus.setupFocus(document.body, updateFocusHint);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

module.exports = {
  router: router,
};
