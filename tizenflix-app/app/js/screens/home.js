/**
 * Home / browse screen — hero banner + TMDB rows.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var hero = require("../components/hero.js");
var row = require("../components/row.js");
var playback = require("../services/playback.js");

var viewMode = "home";

function setMode(mode) {
  viewMode = mode || "home";
}

function filterRows(rows) {
  if (viewMode === "trending") {
    return rows.filter(function (r) {
      return r.id.indexOf("trending") !== -1;
    });
  }
  if (viewMode === "tv") {
    return rows.filter(function (r) {
      return r.id.indexOf("-tv") !== -1;
    });
  }
  if (viewMode === "movies") {
    return rows.filter(function (r) {
      return r.id.indexOf("-movies") !== -1;
    });
  }
  return rows;
}

function openItem(item) {
  if (item.type === "tv") {
    router.navigate("detail-tv", { tmdbId: item.id, title: item.title });
  } else {
    router.navigate("detail-movie", { tmdbId: item.id, title: item.title });
  }
}

function playItem(item, onStatus) {
  if (item.type === "tv") {
    return playback.playTvEpisode(item.id, 1, 1, item.title, onStatus);
  }
  return playback.playMovie(item.id, item.title, onStatus);
}

function showError(el, message) {
  var banner = document.createElement("div");
  banner.className = "error-banner";
  banner.textContent = message;
  el.appendChild(banner);
}

function loadContent(el) {
  api
    .browseRows()
    .then(function (data) {
      var rows = filterRows(data.rows || []);
      if (!rows.length) {
        showError(el, "No browse rows available.");
        return null;
      }

      var heroRowId = "trending-tv";
      for (var h = 0; h < rows.length; h++) {
        if (rows[h].id === "trending-tv") {
          heroRowId = rows[h].id;
          break;
        }
      }

      return api.browseRow(heroRowId).then(function (heroData) {
        return { rows: rows, heroItems: heroData.items || [] };
      });
    })
    .then(function (bundle) {
      if (!bundle) return;

      el.innerHTML = "";

      if (bundle.heroItems.length && viewMode === "home") {
        var featured = bundle.heroItems[0];
        featured.rank = 1;
        el.appendChild(
          hero.renderHero(featured, {
            onPlay: function (item) {
              playItem(item, window.TizenflixApp && window.TizenflixApp.showStatus).catch(function (err) {
                if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
              });
            },
            onInfo: openItem,
          })
        );
      }

      var pending = bundle.rows.length;
      var done = 0;

      function rowLoaded() {
        done += 1;
      }

      for (var i = 0; i < bundle.rows.length; i++) {
        (function (rowDef) {
          api
            .browseRow(rowDef.id)
            .then(function (rowData) {
              var items = rowData.items || [];
              if (items.length) {
                el.appendChild(row.createRow(rowDef.title, items, openItem));
              }
            })
            .catch(function () {
              /* skip failed row */
            })
            .then(rowLoaded);
        })(bundle.rows[i]);
      }
    })
    .catch(function (err) {
      el.innerHTML = "";
      var msg = err.message || String(err);
      if (msg.indexOf("503") !== -1 || msg.indexOf("TMDB") !== -1) {
        showError(
          el,
          "Catalog unavailable — set TMDB_API_KEY in tizenflix-api/.env and restart the API. " +
            "Browser: use Settings to point API URL to http://localhost:8790"
        );
      } else {
        showError(el, "Could not load catalog: " + msg);
      }
    });
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-home";
  el.innerHTML = '<div class="loading-msg">Loading catalog…</div>';
  container.appendChild(el);
  loadContent(el);
}

module.exports = {
  setMode: setMode,
  render: render,
};
