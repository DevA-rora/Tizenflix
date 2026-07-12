/**
 * Search screen — OSK keyboard, person suggestions, live landscape results.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var focus = require("../core/focus.js");
var card = require("../components/card.js");
var osk = require("../components/osk-keyboard.js");

var DEBOUNCE_MS = 350;
var RESULTS_PER_ROW = 3;
var MAX_SUGGESTIONS = 8;

var searchTimer = null;
var suggestTimer = null;
var searchGen = 0;
var suggestGen = 0;
var keyboardHandler = null;
var screenEl = null;
var keyboardEl = null;
var queryDisplay = null;
var suggestionsEl = null;
var resultsGrid = null;

function openItem(item) {
  focus.rememberMainFocus();
  if (item.type === "tv") {
    router.navigate("detail-tv", { tmdbId: item.id, title: item.title });
  } else {
    router.navigate("detail-movie", { tmdbId: item.id, title: item.title });
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clearTimers() {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  if (suggestTimer) {
    clearTimeout(suggestTimer);
    suggestTimer = null;
  }
}

function getCrossRightTarget() {
  if (!resultsGrid) return "search-suggestions";
  var firstRow = resultsGrid.querySelector('[data-focus-row^="search-results-"]');
  if (firstRow) return firstRow.getAttribute("data-focus-row");
  return "search-suggestions";
}

function updateCrossRightTargets() {
  if (!keyboardEl) return;
  var target = getCrossRightTarget();
  var keys = keyboardEl.querySelectorAll(".osk-key[data-cross-right]");
  for (var i = 0; i < keys.length; i++) {
    keys[i].setAttribute("data-cross-right", target);
  }
}

function updateQueryDisplay(q) {
  if (!queryDisplay) return;
  queryDisplay.textContent = q || "";
}

function renderSuggestions(items) {
  if (!suggestionsEl) return;
  suggestionsEl.innerHTML = "";

  for (var i = 0; i < items.length && i < MAX_SUGGESTIONS; i++) {
    var person = items[i];
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-suggestion focusable";
    btn.textContent = person.name;
    btn.setAttribute("aria-label", person.name);
    btn.setAttribute("data-cross-right", getCrossRightTarget());
    (function (name) {
      btn.addEventListener("click", function () {
        if (keyboardEl && keyboardEl.setQuery) {
          keyboardEl.setQuery(name);
        }
        runSearch(name);
        runSuggest(name);
      });
    })(person.name);
    suggestionsEl.appendChild(btn);
  }

  updateCrossRightTargets();
}

function renderResults(items, q) {
  if (!resultsGrid) return;
  resultsGrid.innerHTML = "";

  if (!q) return;

  if (!items.length) {
    resultsGrid.innerHTML =
      '<p class="search-empty-msg">No results for "' + escapeHtml(q) + '".</p>';
    updateCrossRightTargets();
    return;
  }

  var rowIdx = 0;
  for (var i = 0; i < items.length; i += RESULTS_PER_ROW) {
    var rowEl = document.createElement("div");
    rowEl.className = "search-results-row";
    rowEl.setAttribute("data-focus-row", "search-results-" + rowIdx);

    var track = document.createElement("div");
    track.className = "row-track search-results-track";

    for (var j = i; j < i + RESULTS_PER_ROW && j < items.length; j++) {
      var cardEl = card.createCard(items[j], openItem, { layout: "landscape" });
      if (j === i) {
        cardEl.setAttribute("data-cross-left", "osk-3");
      }
      track.appendChild(cardEl);
    }

    rowEl.appendChild(track);
    resultsGrid.appendChild(rowEl);
    rowIdx += 1;
  }

  updateCrossRightTargets();
}

function runSuggest(q) {
  if (!q) {
    renderSuggestions([]);
    return;
  }

  suggestGen += 1;
  var gen = suggestGen;

  api
    .searchSuggest(q)
    .then(function (data) {
      if (gen !== suggestGen) return;
      renderSuggestions(data.results || []);
    })
    .catch(function () {
      if (gen !== suggestGen) return;
      renderSuggestions([]);
    });
}

function runSearch(q) {
  if (!q) {
    if (resultsGrid) resultsGrid.innerHTML = "";
    updateCrossRightTargets();
    return;
  }

  searchGen += 1;
  var gen = searchGen;

  api
    .search(q)
    .then(function (data) {
      if (gen !== searchGen) return;
      renderResults(data.results || [], q);
    })
    .catch(function (err) {
      if (gen !== searchGen) return;
      if (resultsGrid) {
        resultsGrid.innerHTML =
          '<div class="error-banner">Search failed: ' +
          escapeHtml(err.message || String(err)) +
          "</div>";
      }
    });
}

function scheduleSearch(q) {
  clearTimers();
  updateQueryDisplay(q);

  if (!q) {
    searchGen += 1;
    suggestGen += 1;
    if (resultsGrid) resultsGrid.innerHTML = "";
    renderSuggestions([]);
    updateCrossRightTargets();
    return;
  }

  searchTimer = setTimeout(function () {
    searchTimer = null;
    runSearch(q);
  }, DEBOUNCE_MS);

  suggestTimer = setTimeout(function () {
    suggestTimer = null;
    runSuggest(q);
  }, DEBOUNCE_MS);
}

function onQueryChange(q) {
  scheduleSearch(q);
}

function wireBrowserKeyboard() {
  if (!document.body.classList.contains("browser-dev")) return;

  keyboardHandler = function (e) {
    if (router.current() !== "search") return;
    if (!keyboardEl) return;

    var key = e.key || "";
    if (key.length === 1 && /[a-z0-9 ]/i.test(key)) {
      if (key === " ") keyboardEl.space();
      else keyboardEl.appendChar(key.toLowerCase());
      e.preventDefault();
      return;
    }
    if (key === "Backspace") {
      keyboardEl.backspace();
      e.preventDefault();
      return;
    }
  };

  document.addEventListener("keydown", keyboardHandler);
}

function unwireBrowserKeyboard() {
  if (keyboardHandler) {
    document.removeEventListener("keydown", keyboardHandler);
    keyboardHandler = null;
  }
}

function render(container) {
  clearTimers();
  searchGen += 1;
  suggestGen += 1;

  var el = document.createElement("div");
  el.className = "screen screen-search";
  el.innerHTML =
    '<div class="search-layout">' +
    '<aside class="search-pane-left">' +
    '<div class="osk-mount"></div>' +
    '<div class="search-suggestions" data-focus-row="search-suggestions"></div>' +
    "</aside>" +
    '<section class="search-pane-right">' +
    '<div class="search-query-display" aria-live="polite"></div>' +
    '<div class="search-results-grid"></div>' +
    "</section>" +
    "</div>";

  container.appendChild(el);
  screenEl = el;
  queryDisplay = el.querySelector(".search-query-display");
  suggestionsEl = el.querySelector(".search-suggestions");
  resultsGrid = el.querySelector(".search-results-grid");

  var mount = el.querySelector(".osk-mount");
  keyboardEl = osk.createKeyboard({
    onChange: onQueryChange,
    crossRight: "search-suggestions",
  });
  mount.appendChild(keyboardEl);

  wireBrowserKeyboard();
}

function onLeave() {
  clearTimers();
  unwireBrowserKeyboard();
  screenEl = null;
  keyboardEl = null;
  queryDisplay = null;
  suggestionsEl = null;
  resultsGrid = null;
}

module.exports = {
  render: render,
  onLeave: onLeave,
};
