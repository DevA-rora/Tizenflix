/**
 * Simple screen router for TV app — stack-based navigation with Back key.
 */

var focus = require("../core/focus.js");
var playback = require("../services/playback.js");
var choreography = require("../core/choreography.js");

var stack = [];
var screens = {};
var rootEl = null;
var onFocusHint = null;
var focusSidebarOnRender = false;
var isInitialRender = true;

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
  if (!rootEl) return Promise.resolve();
  var name = current();
  var screen = name ? screens[name] : null;
  rootEl.innerHTML = "";
  if (screen && typeof screen.render === "function") {
    screen.render(rootEl);
  }
  updateImmersiveMode();
  if (focusSidebarOnRender) {
    focusSidebarOnRender = false;
    focus.focusSidebar(name || "");
  } else {
    focus.afterScreenRender(name || "");
  }
  return Promise.resolve();
}

function renderWithTransition(options) {
  options = options || {};
  if (!rootEl) return Promise.resolve();

  if (isInitialRender) {
    isInitialRender = false;
    return render();
  }

  return choreography.runScreenTransition(function () {
    var name = current();
    var screen = name ? screens[name] : null;
    rootEl.innerHTML = "";
    if (screen && typeof screen.render === "function") {
      screen.render(rootEl);
    }
    updateImmersiveMode();
  }, options).then(function () {
    if (focusSidebarOnRender) {
      focusSidebarOnRender = false;
      focus.focusSidebar(current() || "");
    } else {
      focus.afterScreenRender(current() || "");
    }
  });
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
  if (!screen) return Promise.resolve();
  playback.stop({ skipRerender: true });
  stack.push(name);
  if (typeof screen.onEnter === "function") {
    screen.onEnter(params || {});
  }
  return renderWithTransition({ targetScreen: name });
}

function replace(name, params) {
  leaveCurrentScreen();
  stack = [];
  return navigate(name, params);
}

function canBack() {
  return stack.length > 1;
}

function back() {
  if (stack.length <= 1) return Promise.resolve(false);
  playback.stop({ skipRerender: true });
  var leaving = stack.pop();
  var screen = screens[leaving];
  if (screen && typeof screen.onLeave === "function") {
    screen.onLeave();
  }
  return renderWithTransition({ targetScreen: current() }).then(function () {
    var now = current();
    if (BROWSE_SCREENS[now]) {
      focus.restoreMainFocus();
    }
    return true;
  });
}

function rerender() {
  return renderWithTransition({ skipTransition: true });
}

function rerenderWithSidebarFocus() {
  focusSidebarOnRender = true;
  return renderWithTransition({ skipTransition: true });
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
  canBack: canBack,
  current: current,
  rerender: rerender,
  rerenderWithSidebarFocus: rerenderWithSidebarFocus,
  init: init,
};
