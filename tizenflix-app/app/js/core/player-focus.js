/**
 * D-pad focus for player chrome overlay zones.
 */

var FOCUS_SELECTOR = "button:not(:disabled), [tabindex='0']";
var currentEl = null;
var keyHandler = null;
var onFocusChange = null;
var getZones = null;

function setZoneProvider(fn) {
  getZones = fn;
}

function getFocusables(root) {
  if (!root) return [];
  var nodes = root.querySelectorAll(FOCUS_SELECTOR);
  var list = [];
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (el.disabled) continue;
    if (el.offsetParent === null && el !== currentEl) continue;
    list.push(el);
  }
  return list;
}

function clearFocus() {
  var all = document.querySelectorAll(".player-chrome .tv-focus");
  for (var i = 0; i < all.length; i++) {
    all[i].classList.remove("tv-focus");
  }
}

function focusElement(el) {
  if (!el) return false;
  clearFocus();
  currentEl = el;
  el.classList.add("tv-focus");
  if (el.scrollIntoView) {
    try {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch (err) {
      el.scrollIntoView(false);
    }
  }
  if (onFocusChange) {
    var label = el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 40);
    onFocusChange(label);
  }
  return true;
}

function getZoneRow(el) {
  if (!el) return null;
  var row = el.closest("[data-player-zone]");
  return row ? row.getAttribute("data-player-zone") : null;
}

function getRowFocusables(zoneId) {
  if (!getZones) return [];
  var zones = getZones();
  var row = zones[zoneId];
  return row ? getFocusables(row) : [];
}

function indexInRow(el) {
  var zone = getZoneRow(el);
  var list = getRowFocusables(zone);
  for (var i = 0; i < list.length; i++) {
    if (list[i] === el) return i;
  }
  return -1;
}

function zoneOrder() {
  return ["top", "progress", "dock", "rail", "panel"];
}

function moveHorizontal(el, dir) {
  var zone = getZoneRow(el);
  var list = getRowFocusables(zone);
  var idx = indexInRow(el);
  if (idx < 0 || !list.length) return null;
  var next = idx + dir;
  if (next < 0 || next >= list.length) return null;
  return list[next];
}

function moveVertical(el, dir) {
  var order = zoneOrder();
  var zone = getZoneRow(el);
  var zIdx = -1;
  for (var i = 0; i < order.length; i++) {
    if (order[i] === zone) {
      zIdx = i;
      break;
    }
  }
  if (zIdx < 0) return null;
  var nextZ = zIdx + dir;
  while (nextZ >= 0 && nextZ < order.length) {
    var list = getRowFocusables(order[nextZ]);
    if (list.length) {
      var idx = indexInRow(el);
      if (idx >= 0 && idx < list.length) return list[idx];
      return list[0];
    }
    nextZ += dir;
  }
  return null;
}

function onKeyDown(e) {
  if (!document.body.classList.contains("is-playing")) return false;
  if (!currentEl) return false;

  var key = e.key || "";
  var code = e.keyCode;
  var isLeft = key === "ArrowLeft" || code === 37;
  var isRight = key === "ArrowRight" || code === 39;
  var isUp = key === "ArrowUp" || code === 38;
  var isDown = key === "ArrowDown" || code === 40;
  var isEnter = code === 13 || key === "Enter";

  if (isEnter) {
    if (currentEl.click) currentEl.click();
    e.preventDefault();
    return true;
  }

  var next = null;
  if (isLeft) next = moveHorizontal(currentEl, -1);
  else if (isRight) next = moveHorizontal(currentEl, 1);
  else if (isUp) next = moveVertical(currentEl, -1);
  else if (isDown) next = moveVertical(currentEl, 1);

  if (next && next !== currentEl) {
    focusElement(next);
  }
  if (isLeft || isRight || isUp || isDown) {
    e.preventDefault();
    return true;
  }
  return false;
}

function focusDefault() {
  var list = getRowFocusables("dock");
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === "playerPlayPause") return focusElement(list[i]);
  }
  if (list.length) return focusElement(list[0]);
  list = getRowFocusables("top");
  if (list.length) return focusElement(list[0]);
  return false;
}

function init(cb) {
  onFocusChange = cb || null;
  if (keyHandler) document.removeEventListener("keydown", keyHandler, true);
  keyHandler = function (e) {
    onKeyDown(e);
  };
  document.addEventListener("keydown", keyHandler, true);
}

function destroy() {
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler, true);
    keyHandler = null;
  }
  clearFocus();
  currentEl = null;
  getZones = null;
}

module.exports = {
  init: init,
  destroy: destroy,
  focusElement: focusElement,
  focusDefault: focusDefault,
  setZoneProvider: setZoneProvider,
  getCurrent: function () {
    return currentEl;
  },
};
