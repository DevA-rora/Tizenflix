/**
 * Zone-based D-pad focus for Tizen TV — sidebar vs main, row-aware Up/Down.
 */

var FOCUS_SELECTOR =
  "button:not(:disabled), input[type='text']:not(:disabled), a[href], [tabindex='0']";

var onFocusChange = null;
var currentEl = null;
var lastSidebarEl = null;
var rememberedMainEl = null;
var keyHandler = null;

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

function labelFor(el) {
  if (!el) return "";
  if (el.id === "apiBaseInput") return "API URL";
  if (el.id === "saveApiBtn") return "Save & test";
  if (el.id === "devModeBtn") return "Dev mode";
  if (el.id === "detailPlayBtn") return "Play";
  if (el.id === "detailBackBtn") return "Back";
  if (el.id === "btnStop") return "Stop";
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  var text = (el.textContent || "").trim();
  if (text) return text.slice(0, 40);
  return el.tagName;
}

function clearAllFocus() {
  var all = document.querySelectorAll(".tv-focus");
  for (var i = 0; i < all.length; i++) {
    all[i].classList.remove("tv-focus");
  }
}

function isInSidebar(el) {
  var sidebar = document.getElementById("sidebar");
  return !!(sidebar && el && sidebar.contains(el));
}

function getSidebarFocusables() {
  var sidebar = document.getElementById("sidebar");
  return sidebar ? getFocusables(sidebar) : [];
}

function getMainRoot() {
  return document.getElementById("main");
}

function resetMainScroll() {
  var main = getMainRoot();
  if (main) main.scrollTop = 0;
}

function scrollIntoView(el) {
  if (!el || !el.getBoundingClientRect) return;

  var main = getMainRoot();
  if (!main) {
    if (el.scrollIntoView) {
      try {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (err) {
        el.scrollIntoView(false);
      }
    }
    return;
  }

  var elRect = el.getBoundingClientRect();
  var mainRect = main.getBoundingClientRect();

  if (elRect.bottom > mainRect.bottom - 16) {
    main.scrollTop += elRect.bottom - mainRect.bottom + 32;
  } else if (elRect.top < mainRect.top + 16) {
    main.scrollTop = Math.max(0, main.scrollTop - (mainRect.top - elRect.top + 32));
  }
}

function focusElement(el) {
  if (!el) return false;
  clearAllFocus();
  currentEl = el;
  el.classList.add("tv-focus");
  scrollIntoView(el);
  if (isInSidebar(el)) lastSidebarEl = el;
  if (onFocusChange) onFocusChange(labelFor(el));
  return true;
}

function getFocusRowContainer(el) {
  if (!el) return null;
  var row = el.closest("[data-focus-row]");
  if (row) return row;
  var track = el.closest(".row-track");
  if (track && track.parentElement) return track.parentElement;
  return null;
}

function getFocusRowId(el) {
  var row = getFocusRowContainer(el);
  return row ? row.getAttribute("data-focus-row") : null;
}

function getRowFocusables(rowId) {
  var main = getMainRoot();
  if (!main || !rowId) return [];
  var row = main.querySelector('[data-focus-row="' + rowId + '"]');
  if (!row) return [];
  if (row.getAttribute("data-focus-row") === "hero") {
    return getFocusables(row);
  }
  var track = row.querySelector(".row-track");
  return track ? getFocusables(track) : getFocusables(row);
}

function getOrderedRowIds() {
  var main = getMainRoot();
  if (!main) return [];
  var nodes = main.querySelectorAll("[data-focus-row]");
  var ids = [];
  for (var i = 0; i < nodes.length; i++) {
    var id = nodes[i].getAttribute("data-focus-row");
    if (id && ids.indexOf(id) === -1) ids.push(id);
  }
  return ids;
}

function indexInRow(el) {
  var rowId = getFocusRowId(el);
  var items = getRowFocusables(rowId);
  for (var i = 0; i < items.length; i++) {
    if (items[i] === el) return i;
  }
  return 0;
}

function handleSidebarNav(el, dir) {
  var nav = getSidebarFocusables();
  if (!nav.length) return null;
  var idx = nav.indexOf(el);
  if (idx === -1) idx = 0;
  if (dir === "up") return nav[(idx - 1 + nav.length) % nav.length];
  if (dir === "down") return nav[(idx + 1) % nav.length];
  return el;
}

function handleMainLeft(el) {
  var items = getRowFocusables(getFocusRowId(el));
  var idx = indexInRow(el);
  if (idx > 0) return items[idx - 1];
  var nav = getSidebarFocusables();
  if (lastSidebarEl && nav.indexOf(lastSidebarEl) !== -1) return lastSidebarEl;
  return nav.length ? nav[0] : el;
}

function handleMainRight(el) {
  var items = getRowFocusables(getFocusRowId(el));
  var idx = indexInRow(el);
  if (idx < items.length - 1) return items[idx + 1];
  return el;
}

function getLinearMainFocusables() {
  var main = getMainRoot();
  return main ? getFocusables(main) : [];
}

function handleMainVerticalLinear(el, dir) {
  var items = getLinearMainFocusables();
  var idx = items.indexOf(el);
  if (idx === -1) return el;
  if (dir === "up") return idx > 0 ? items[idx - 1] : el;
  if (dir === "down") return idx < items.length - 1 ? items[idx + 1] : el;
  return el;
}

function handleMainVertical(el, dir) {
  var rowId = getFocusRowId(el);
  if (!rowId) return handleMainVerticalLinear(el, dir);

  var rows = getOrderedRowIds();
  var rowIdx = rows.indexOf(rowId);
  if (rowIdx === -1) return el;
  var targetIdx = dir === "up" ? rowIdx - 1 : rowIdx + 1;
  if (targetIdx < 0 || targetIdx >= rows.length) return el;
  var targetItems = getRowFocusables(rows[targetIdx]);
  if (!targetItems.length) return el;
  var col = indexInRow(el);
  return targetItems[Math.min(col, targetItems.length - 1)];
}

function focusDefaultMain(selector) {
  resetMainScroll();
  var main = getMainRoot();
  if (!main) return false;

  var el = null;
  if (selector) {
    el = main.querySelector(selector) || document.querySelector(selector);
  }
  if (!el) el = main.querySelector(".hero .btn-play");
  if (!el) el = main.querySelector(".card");
  if (!el) {
    var focusables = getFocusables(main);
    el = focusables.length ? focusables[0] : null;
  }
  return el ? focusElement(el) : false;
}

function rememberMainFocus() {
  if (currentEl && !isInSidebar(currentEl)) {
    rememberedMainEl = currentEl;
  }
}

function restoreMainFocus() {
  if (rememberedMainEl && document.body.contains(rememberedMainEl)) {
    return focusElement(rememberedMainEl);
  }
  return focusDefaultMain();
}

var SCREEN_FOCUS = {
  home: [".hero .btn-play", ".card", "button"],
  trending: [".card", "button"],
  tv: [".card", "button"],
  movies: [".card", "button"],
  search: ["#searchInput", "button"],
  settings: ["#apiBaseInput", "button"],
  mylist: ["button"],
  random: ["button"],
  categories: ["button"],
};

function afterScreenRender(screenName) {
  resetMainScroll();
  var selectors = SCREEN_FOCUS[screenName];
  if (selectors) {
    var main = getMainRoot();
    if (main) {
      for (var i = 0; i < selectors.length; i++) {
        var el = main.querySelector(selectors[i]);
        if (el) {
          focusElement(el);
          return;
        }
      }
    }
  }
  if (screenName !== "detail-movie" && screenName !== "detail-tv") {
    focusDefaultMain();
  }
}

function onKeyDown(e) {
  if (document.body.classList.contains("is-playing")) return;

  var key = e.key || "";
  var code = e.keyCode;
  var isLeft = key === "ArrowLeft" || code === 37;
  var isRight = key === "ArrowRight" || code === 39;
  var isUp = key === "ArrowUp" || code === 38;
  var isDown = key === "ArrowDown" || code === 40;
  var isEnter = code === 13 || key === "Enter";

  if (!currentEl) {
    focusDefaultMain();
    if (isLeft || isRight || isUp || isDown || isEnter) e.preventDefault();
    return;
  }

  if (isEnter) {
    if (currentEl.click) currentEl.click();
    e.preventDefault();
    return;
  }

  var next = null;
  var inSidebar = isInSidebar(currentEl);

  if (inSidebar) {
    if (isUp) next = handleSidebarNav(currentEl, "up");
    else if (isDown) next = handleSidebarNav(currentEl, "down");
    else if (isRight) {
      focusDefaultMain();
      e.preventDefault();
      return;
    }
  } else {
    if (isLeft) next = handleMainLeft(currentEl);
    else if (isRight) next = handleMainRight(currentEl);
    else if (isUp) next = handleMainVertical(currentEl, "up");
    else if (isDown) next = handleMainVertical(currentEl, "down");
  }

  if (next && next !== currentEl) {
    focusElement(next);
  }
  if (isLeft || isRight || isUp || isDown) e.preventDefault();
}

function init(cb) {
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler);
  }
  onFocusChange = cb || null;
  keyHandler = onKeyDown;
  document.addEventListener("keydown", keyHandler);
}

function destroy() {
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
  clearAllFocus();
  currentEl = null;
}

/** @deprecated Gate test only — linear focus on a root element */
function setupFocus(root, onFocusChangeCb) {
  init(onFocusChangeCb);
  var list = getFocusables(root);
  if (list.length) focusElement(list[0]);
}

module.exports = {
  init: init,
  destroy: destroy,
  focusElement: focusElement,
  focusDefaultMain: focusDefaultMain,
  rememberMainFocus: rememberMainFocus,
  restoreMainFocus: restoreMainFocus,
  resetMainScroll: resetMainScroll,
  afterScreenRender: afterScreenRender,
  getFocusables: getFocusables,
  setupFocus: setupFocus,
};
