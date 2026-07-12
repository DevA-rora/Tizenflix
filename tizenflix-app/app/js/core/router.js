/**
 * Simple screen router for TV app — stack-based navigation with Back key.
 */

var focus = require("../core/focus.js");

var stack = [];
var screens = {};
var rootEl = null;
var onFocusHint = null;

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
  if (onFocusHint) {
    focus.setupFocus(document.body, onFocusHint);
  }
}

function navigate(name, params) {
  var screen = screens[name];
  if (!screen) return;
  stack.push(name);
  if (typeof screen.onEnter === "function") {
    screen.onEnter(params || {});
  }
  render();
}

function replace(name, params) {
  stack = [];
  navigate(name, params);
}

function back() {
  if (stack.length <= 1) return false;
  var leaving = stack.pop();
  var screen = screens[leaving];
  if (screen && typeof screen.onLeave === "function") {
    screen.onLeave();
  }
  render();
  return true;
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
  init: init,
};
