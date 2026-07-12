/**
 * Simple screen router for TV app — stack-based navigation with Back key.
 */

var focus = require("../core/focus.js");
var playback = require("../services/playback.js");

var stack = [];
var screens = {};
var rootEl = null;
var onFocusHint = null;

var BROWSE_SCREENS = {
  home: true,
  trending: true,
  tv: true,
  movies: true,
  search: true,
};

var IMMERSIVE_SCREENS = {
  "detail-movie": true,
  "detail-tv": true,
};

function setImmersiveMode(enabled) {
  if (enabled) {
    document.body.classList.add("immersive-detail");
  } else {
    document.body.classList.remove("immersive-detail");
  }
}

function updateImmersiveMode() {
  var name = current();
  setImmersiveMode(!!(name && IMMERSIVE_SCREENS[name]));
}

function register(name, screen) {
  screens[name] = screen;
}

function current() {
  return stack.length ? stack[stack.length - 1] : null;
}

function render() {
  if (!rootEl) return;
  var name = current();
  var screen = name ? screens[name] : null;
  rootEl.innerHTML = "";
  if (screen && typeof screen.render === "function") {
    screen.render(rootEl);
  }
  updateImmersiveMode();
  focus.afterScreenRender(name || "");
}

function leaveCurrentScreen() {
  var name = current();
  if (!name) return;
  var screen = screens[name];
  if (screen && typeof screen.onLeave === "function") {
    screen.onLeave();
  }
}

function navigate(name, params) {
  var screen = screens[name];
  if (!screen) return;
  playback.stop({ skipRerender: true });
  stack.push(name);
  if (typeof screen.onEnter === "function") {
    screen.onEnter(params || {});
  }
  render();
}

function replace(name, params) {
  leaveCurrentScreen();
  stack = [];
  navigate(name, params);
}

function back() {
  if (stack.length <= 1) return false;
  playback.stop({ skipRerender: true });
  var leaving = stack.pop();
  var screen = screens[leaving];
  if (screen && typeof screen.onLeave === "function") {
    screen.onLeave();
  }
  render();
  var now = current();
  if (BROWSE_SCREENS[now]) {
    focus.restoreMainFocus();
  }
  return true;
}

function rerender() {
  render();
}

function init(options) {
  rootEl = options.root;
  onFocusHint = options.onFocusHint || null;
  if (options.initial) {
    replace(options.initial);
  }
}

module.exports = {
  register: register,
  navigate: navigate,
  replace: replace,
  back: back,
  current: current,
  rerender: rerender,
  init: init,
};
