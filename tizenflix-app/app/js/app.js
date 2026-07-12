/**
 * Tizenflix app entry — bootstrap router and global handlers.
 */

var router = require("./core/router.js");
var focus = require("./core/focus.js");
var debug = require("./core/debug.js");
var player = require("./player/player.js");
var playback = require("./services/playback.js");

var home = require("./screens/home.js");
var search = require("./screens/search.js");
var settings = require("./screens/settings.js");
var mylist = require("./screens/mylist.js");
var detailMovie = require("./screens/detail-movie.js");
var detailTv = require("./screens/detail-tv.js");

function showStatus(message, isError) {
  var bar = document.getElementById("statusBar");
  if (!bar) return;
  bar.textContent = message;
  bar.classList.remove("hidden", "is-error");
  if (isError) bar.classList.add("is-error");
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(function () {
    bar.classList.add("hidden");
  }, 5000);
}

function updateFocusHint(label) {
  var el = document.getElementById("focusHint");
  if (el) el.textContent = "Focused: " + label;
}

function browseScreen(mode) {
  return {
    onEnter: function () {
      home.setMode(mode);
    },
    render: home.render,
  };
}

function setSidebarActive(screen) {
  var nav = document.getElementById("sidebar");
  if (!nav) return;
  var items = nav.querySelectorAll(".nav-item");
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove("active");
    if (items[i].getAttribute("data-screen") === screen) {
      items[i].classList.add("active");
    }
  }
}

function wireSidebar() {
  var nav = document.getElementById("sidebar");
  if (!nav) return;
  nav.addEventListener("click", function (e) {
    var btn = e.target;
    while (btn && btn !== nav && !btn.getAttribute("data-screen")) {
      btn = btn.parentNode;
    }
    if (!btn || btn === nav) return;
    var screen = btn.getAttribute("data-screen");
    if (!screen) return;
    router.replace(screen);
    setSidebarActive(screen);
  });
}

function wirePlayback() {
  var stopBtn = document.getElementById("btnStop");
  if (stopBtn) {
    stopBtn.addEventListener("click", function () {
      playback.stop();
    });
  }
}

function wireGlobalKeys() {
  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 10009 || e.key === "Back") {
      if (document.body.classList.contains("is-playing")) {
        playback.stop();
        e.preventDefault();
        return;
      }
      if (router.back()) {
        e.preventDefault();
      }
    }
    if (player.isMediaPlayPauseKey(e)) {
      var video = document.getElementById("video");
      if (video) player.togglePlayPause(video);
    }
  });
}

function init() {
  if (!player.isTizenTv()) {
    document.body.classList.add("browser-dev");
  }

  debug.debugClear();
  debug.debugLog("Tizenflix — Tizen TV: " + (player.isTizenTv() ? "yes" : "no"));

  router.register("home", browseScreen("home"));
  router.register("trending", browseScreen("trending"));
  router.register("tv", browseScreen("tv"));
  router.register("movies", browseScreen("movies"));
  router.register("search", search);
  router.register("settings", settings);
  router.register("mylist", mylist);
  router.register("detail-movie", detailMovie);
  router.register("detail-tv", detailTv);

  router.init({
    root: document.getElementById("screen"),
    initial: "home",
    onFocusHint: updateFocusHint,
  });

  setSidebarActive("home");
  wireSidebar();
  wirePlayback();
  wireGlobalKeys();
  focus.setupFocus(document.body, updateFocusHint);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.TizenflixApp = {
  router: router,
  showStatus: showStatus,
};

module.exports = {
  router: router,
  showStatus: showStatus,
};
