/**
 * Search screen — query TMDB catalog via API.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var focus = require("../core/focus.js");
var card = require("../components/card.js");

function openItem(item) {
  focus.rememberMainFocus();
  if (item.type === "tv") {
    router.navigate("detail-tv", { tmdbId: item.id, title: item.title });
  } else {
    router.navigate("detail-movie", { tmdbId: item.id, title: item.title });
  }
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-search";
  el.innerHTML =
    "<h2>Search</h2>" +
    '<form class="search-form" id="searchForm">' +
    '<input type="text" id="searchInput" class="focusable" placeholder="Movies, TV shows…" autocomplete="off" />' +
    '<button type="submit" class="btn btn-play focusable">Search</button>' +
    "</form>" +
    '<div id="searchResults" class="search-results"></div>';
  container.appendChild(el);

  var form = el.querySelector("#searchForm");
  var input = el.querySelector("#searchInput");
  var results = el.querySelector("#searchResults");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = (input.value || "").trim();
    if (!q) return;
    results.innerHTML = '<div class="loading-msg">Searching…</div>';

    api
      .search(q)
      .then(function (data) {
        var items = data.results || [];
        results.innerHTML = "";
        if (!items.length) {
          results.innerHTML = '<p class="loading-msg">No results for “' + q + "”.</p>";
          return;
        }
        for (var i = 0; i < items.length; i++) {
          results.appendChild(card.createCard(items[i], openItem));
        }
      })
      .catch(function (err) {
        results.innerHTML =
          '<div class="error-banner">Search failed: ' + (err.message || err) + "</div>";
      });
  });
}

module.exports = {
  render: render,
};
