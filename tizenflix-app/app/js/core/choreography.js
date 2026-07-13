/**
 * Motion choreography — screen transitions, focus sweep, detail handoff.
 */

var motion = require("./motion.js");
var focus = require("./focus.js");

var IMMERSIVE_SCREENS = {
  "detail-movie": true,
  "detail-tv": true,
};

var transitionRunning = false;

function waitMs(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function getScreenEl() {
  return document.getElementById("screen");
}

function pulseZoneCross() {
  if (motion.prefersReducedMotion()) return;
  var main = document.getElementById("main");
  if (!main) return;
  main.classList.remove("zone-cross-pulse");
  void main.offsetWidth;
  main.classList.add("zone-cross-pulse");
  var profile = motion.getMotionProfile();
  setTimeout(function () {
    main.classList.remove("zone-cross-pulse");
  }, profile.zonePulseMs + 80);
}

function runScreenExit(screenEl) {
  if (!screenEl || motion.prefersReducedMotion()) return Promise.resolve();
  var profile = motion.getMotionProfile();
  screenEl.classList.remove("screen-enter", "screen-enter-active");
  screenEl.classList.add("screen-exit");
  return waitMs(profile.screenExitMs).then(function () {
    screenEl.classList.remove("screen-exit");
  });
}

function runScreenEnter(screenEl) {
  if (!screenEl || motion.prefersReducedMotion()) {
    if (screenEl) {
      screenEl.classList.remove("screen-enter", "screen-enter-active", "screen-exit");
    }
    return Promise.resolve();
  }
  var profile = motion.getMotionProfile();
  screenEl.classList.remove("screen-exit");
  screenEl.classList.add("screen-enter");
  return waitMs(16).then(function () {
    screenEl.classList.add("screen-enter-active");
    return waitMs(profile.screenEnterMs);
  }).then(function () {
    screenEl.classList.remove("screen-enter", "screen-enter-active");
  });
}

function runScreenTransition(renderFn, options) {
  options = options || {};
  if (transitionRunning) {
    if (renderFn) renderFn();
    return Promise.resolve();
  }

  var screenEl = getScreenEl();
  if (!screenEl || motion.prefersReducedMotion() || options.skipTransition) {
    if (renderFn) renderFn();
    return Promise.resolve();
  }

  transitionRunning = true;
  var isDetail = !!(options.targetScreen && IMMERSIVE_SCREENS[options.targetScreen]);
  if (isDetail) screenEl.classList.add("screen-to-detail");

  return runScreenExit(screenEl)
    .then(function () {
      if (renderFn) renderFn();
      screenEl.classList.remove("screen-to-detail");
      return runScreenEnter(screenEl);
    })
    .then(function () {
      transitionRunning = false;
    })
    .catch(function () {
      transitionRunning = false;
    });
}

function getCardPosterRect(cardEl) {
  if (!cardEl) return null;
  var poster = cardEl.querySelector(".card-poster");
  var target = poster || cardEl;
  return target.getBoundingClientRect();
}

function playDetailHandoff(cardEl) {
  if (!cardEl || motion.prefersReducedMotion()) return Promise.resolve();

  var profile = motion.getMotionProfile();
  var posterUrl =
    cardEl.getAttribute("data-backdrop") || cardEl.getAttribute("data-poster") || "";
  var rect = getCardPosterRect(cardEl);
  if (!posterUrl || !rect || rect.width < 8) return Promise.resolve();

  var existing = document.getElementById("transition-shell");
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  var shell = document.createElement("div");
  shell.id = "transition-shell";
  shell.className = "transition-shell";

  var poster = document.createElement("div");
  poster.className = "transition-shell-poster";
  poster.style.backgroundImage = "url('" + posterUrl.replace(/'/g, "%27") + "')";
  poster.style.left = Math.round(rect.left) + "px";
  poster.style.top = Math.round(rect.top) + "px";
  poster.style.width = Math.round(rect.width) + "px";
  poster.style.height = Math.round(rect.height) + "px";
  poster.style.webkitTransformOrigin = "center center";
  poster.style.transformOrigin = "center center";

  shell.appendChild(poster);
  document.body.appendChild(shell);

  requestAnimationFrame(function () {
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var scale = Math.max(vw / rect.width, vh / rect.height) * 1.05;
    var dx = vw / 2 - (rect.left + rect.width / 2);
    var dy = vh / 2 - (rect.top + rect.height / 2);
    poster.style.webkitTransform =
      "translate(" + Math.round(dx) + "px," + Math.round(dy) + "px) scale(" + scale + ")";
    poster.style.transform =
      "translate(" + Math.round(dx) + "px," + Math.round(dy) + "px) scale(" + scale + ")";
    shell.classList.add("is-expanding");
  });

  return waitMs(profile.handoffMs).then(function () {
    if (shell.parentNode) shell.parentNode.removeChild(shell);
  });
}

function openDetail(item, cardEl) {
  if (!item || !item.id) return Promise.resolve();

  var router = require("./router.js");
  var screenName = item.type === "tv" ? "detail-tv" : "detail-movie";
  var params = { tmdbId: item.id, title: item.title || item.name || "" };

  focus.rememberMainFocus();

  var sourceCard = cardEl;
  if (!sourceCard) {
    var current = focus.getCurrentElement();
    if (current && current.classList && current.classList.contains("card")) {
      sourceCard = current;
    }
  }

  return playDetailHandoff(sourceCard).then(function () {
    router.navigate(screenName, params);
  });
}

function animateDetailContentIn(root) {
  if (!root || motion.prefersReducedMotion()) return;
  var content = root.querySelector(".detail-content");
  if (!content) return;
  content.classList.add("detail-content-enter");
  requestAnimationFrame(function () {
    content.classList.add("detail-content-enter-active");
  });
  var profile = motion.getMotionProfile();
  setTimeout(function () {
    content.classList.remove("detail-content-enter", "detail-content-enter-active");
  }, profile.screenEnterMs + 80);
}

function revealDetailEpisodes(sectionEl, onComplete) {
  if (!sectionEl) {
    if (onComplete) onComplete();
    return Promise.resolve();
  }

  if (motion.prefersReducedMotion() || !motion.animationsEnabled()) {
    sectionEl.classList.remove("is-collapsed");
    sectionEl.classList.add("is-revealed");
    focus.scrollDetailSectionToAnchor(sectionEl);
    if (onComplete) onComplete();
    return Promise.resolve();
  }

  sectionEl.classList.remove("is-collapsed");
  sectionEl.classList.add("is-revealing");

  var profile = motion.getMotionProfile();
  return new Promise(function (resolve) {
    requestAnimationFrame(function () {
      sectionEl.classList.add("is-revealed");
      focus.scrollDetailSectionToAnchor(sectionEl);
      waitMs(profile.mainScrollMs).then(function () {
        sectionEl.classList.remove("is-revealing");
        if (onComplete) onComplete();
        resolve();
      });
    });
  });
}

module.exports = {
  pulseZoneCross: pulseZoneCross,
  runScreenTransition: runScreenTransition,
  playDetailHandoff: playDetailHandoff,
  openDetail: openDetail,
  animateDetailContentIn: animateDetailContentIn,
  revealDetailEpisodes: revealDetailEpisodes,
};
