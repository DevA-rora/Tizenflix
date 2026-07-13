/**
 * Tizenflix app entry — bootstrap router and global handlers.
 */

var APP_BUILD = "0.2.1-speed-gap";

var router = require("./core/router.js");
var focus = require("./core/focus.js");
var debug = require("./core/debug.js");
var config = require("./core/config.js");
var motion = require("./core/motion.js");
var player = require("./player/player.js");
var playback = require("./services/playback.js");
var keys = require("./core/keys.js");

var home = require("./screens/home.js");
var search = require("./screens/search.js");
var random = require("./screens/random.js");
var settings = require("./screens/settings.js");
var categories = require("./screens/categories.js");
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

function updateFocusHint(meta) {
  home.onBrowseFocus(meta);
  var label = typeof meta === "string" ? meta : meta && meta.label ? meta.label : "";
  var announcer = document.getElementById("focus-announcer");
  if (announcer && label) announcer.textContent = label;
  var el = document.getElementById("focusHint");
  if (!el) return;
  el.textContent = "Focused: " + label;
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
    items[i].removeAttribute("aria-current");
    if (items[i].getAttribute("data-screen") === screen) {
      items[i].classList.add("active");
      items[i].setAttribute("aria-current", "page");
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
  /* Player chrome handles stop/back via playback.handleBackKey */
}

function wireGlobalKeys() {
  document.addEventListener("keydown", function (e) {
    if (keys.isBackKey(e)) {
      if (document.body.classList.contains("is-playing")) {
        playback.handleBackKey();
        e.preventDefault();
        return;
      }
      if (router.canBack()) {
        router.back();
        e.preventDefault();
        return;
      }
      if (focus.handleBrowseBack()) {
        e.preventDefault();
      }
      return;
    }
    if (document.body.classList.contains("is-playing")) {
      if (player.isMediaPlayPauseKey(e)) {
        var video = document.getElementById("video");
        if (video) player.togglePlayPause(video);
        e.preventDefault();
      }
      return;
    }
  });
}

function applyDevMode() {
  var on = config.getDevMode();
  if (document.body) {
    document.body.classList.toggle("dev-mode-on", on);
    document.body.classList.toggle("dev-mode-off", !on);
  }
}

function init() {
  if (!player.isTizenTv()) {
    document.body.classList.add("browser-dev");
  }

  motion.applyBodyClass();
  applyDevMode();

  debug.debugClear();
  debug.debugLog("Tizenflix build " + APP_BUILD);
  debug.debugLog("Tizenflix — Tizen TV: " + (player.isTizenTv() ? "yes" : "no"));

  router.register("home", browseScreen("home"));
  router.register("random", random);
  router.register("trending", browseScreen("trending"));
  router.register("tv", browseScreen("tv"));
  router.register("movies", browseScreen("movies"));
  router.register("categories", categories);
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
  focus.init(updateFocusHint);
  config.applyGridScale();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.TizenflixApp = {
  router: router,
  showStatus: showStatus,
  setSidebarActive: setSidebarActive,
  updateFocusHint: updateFocusHint,
};

module.exports = {
  router: router,
  showStatus: showStatus,
};
