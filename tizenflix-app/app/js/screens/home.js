/**
 * Home / browse screen — hero banner + TMDB rows with mixed layouts.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var focus = require("../core/focus.js");
var choreography = require("../core/choreography.js");
var hero = require("../components/hero.js");
var row = require("../components/row.js");
var playback = require("../services/playback.js");

var viewMode = "home";
var itemCache = {};
var heroEl = null;
var featuredItem = null;

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

function cacheItems(items) {
  for (var i = 0; i < items.length; i++) {
    itemCache[String(items[i].id)] = items[i];
  }
}

function layoutForRow(rowDef, index) {
  if (index === 0) return "standard";

  if (rowDef.layout === "spotlight" || rowDef.layout === "standard") {
    return rowDef.layout;
  }
  if (viewMode === "home" && index === 1) return "spotlight";
  return "standard";
}

function mapProgressEntry(entry) {
  return {
    id: entry.tmdbId,
    type: entry.type,
    title: entry.title || "Untitled",
    poster: entry.poster || null,
    backdrop: entry.poster || null,
    season: entry.season,
    episode: entry.episode,
    positionSeconds: entry.positionSeconds || 0,
    durationSeconds: entry.durationSeconds || 0,
    percent: entry.percent || 0,
    episodeTitle: entry.episodeTitle || "",
  };
}

function enrichContinueWatching(items) {
  var tasks = items.map(function (item) {
    if (item.type !== "tv" || item.episodeTitle || item.season == null || item.episode == null) {
      return Promise.resolve(item);
    }
    return api
      .getEpisodes(item.id, item.season)
      .then(function (data) {
        var episodes = data.episodes || data.items || [];
        for (var i = 0; i < episodes.length; i++) {
          if (Number(episodes[i].episode) === Number(item.episode)) {
            item.episodeTitle = episodes[i].title || episodes[i].name || "";
            break;
          }
        }
        return item;
      })
      .catch(function () {
        return item;
      });
  });
  return Promise.all(tasks);
}

function openItem(item) {
  choreography.openDetail(item);
}

function resumeItem(item) {
  var onStatus = window.TizenflixApp && window.TizenflixApp.showStatus;
  var startSeconds = item.positionSeconds || 0;
  if (item.type === "tv") {
    var season = item.season || 1;
    var episode = item.episode || 1;
    var label = (item.title || "Show") + " S" + season + "E" + episode;
    return playback
      .playTvEpisode(item.id, season, episode, label, onStatus, {
        showTitle: item.title,
        episodeTitle: item.episodeTitle || "",
        startSeconds: startSeconds,
      })
      .catch(function (err) {
        if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
      });
  }
  return playback
    .playMovie(item.id, item.title, onStatus, { startSeconds: startSeconds })
    .catch(function (err) {
      if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
    });
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

function handleFocusChange(meta) {
  if (!meta || !meta.isCard || !meta.tmdbId) return;
  if (meta.rowId === "hero") return;
  if (viewMode !== "home") return;

  var item = itemCache[meta.tmdbId];
  if (!item) return;

  if (meta.rowId) {
    var main = document.getElementById("main");
    if (main) {
      var rowSection = main.querySelector('[data-focus-row="' + meta.rowId + '"]');
      if (rowSection && rowSection.getAttribute("data-row-layout") === "spotlight") {
        if (typeof rowSection._updateSpotlightMeta === "function") {
          rowSection._updateSpotlightMeta(item);
        }
        if (typeof rowSection._syncSpotlightLayout === "function") {
          rowSection._syncSpotlightLayout();
        }
        return;
      }
    }
  }

  if (!heroEl) return;
  hero.updateHero(heroEl, item);
}

function loadContent(el) {
  itemCache = {};
  heroEl = null;
  featuredItem = null;
  hero.resetHeroState();

  var cwPromise =
    viewMode === "home"
      ? api.continueWatching(20).catch(function () {
          return [];
        })
      : Promise.resolve([]);

  Promise.all([
    api.browseRows(),
    cwPromise,
  ])
    .then(function (results) {
      var data = results[0];
      var cwRaw = results[1] || [];
      var rows = filterRows(data.rows || []);
      if (!rows.length && !cwRaw.length) {
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

      return enrichContinueWatching(cwRaw.map(mapProgressEntry)).then(function (cwItems) {
        if (!rows.length) {
          return { rows: [], heroItems: [], cwItems: cwItems };
        }
        return api.browseRow(heroRowId).then(function (heroData) {
          return { rows: rows, heroItems: heroData.items || [], cwItems: cwItems };
        });
      });
    })
    .then(function (bundle) {
      if (!bundle) return;

      el.innerHTML = "";

      var hasContinueWatching = viewMode === "home" && bundle.cwItems && bundle.cwItems.length > 0;

      if (bundle.heroItems.length && viewMode === "home") {
        featuredItem = bundle.heroItems[0];
        cacheItems(bundle.heroItems);
        heroEl = hero.renderHero(featuredItem, {
          onPlay: function (item) {
            playItem(item, window.TizenflixApp && window.TizenflixApp.showStatus).catch(function (err) {
              if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
            });
          },
          onInfo: openItem,
        });
        el.appendChild(heroEl);
      }

      if (hasContinueWatching) {
        cacheItems(bundle.cwItems);
        el.appendChild(
          row.createRow("Continue Watching", bundle.cwItems, resumeItem, {
            layout: "standard",
            variant: "continue-watching",
          })
        );
      }

      if (!bundle.rows.length) {
        focus.focusDefaultMain();
        return;
      }

      var fetches = bundle.rows.map(function (rowDef, rowIndex) {
        return api
          .browseRow(rowDef.id)
          .then(function (rowData) {
            return { rowDef: rowDef, rowIndex: rowIndex, items: rowData.items || [] };
          })
          .catch(function () {
            return { rowDef: rowDef, rowIndex: rowIndex, items: [] };
          });
      });

      return Promise.all(fetches).then(function (results) {
        var renderedCount = hasContinueWatching ? 1 : 0;
        for (var r = 0; r < results.length; r++) {
          var result = results[r];
          if (!result.items.length) continue;
          cacheItems(result.items);
          var layout = layoutForRow(result.rowDef, result.rowIndex);
          if (renderedCount === 0) layout = "standard";
          renderedCount += 1;
          el.appendChild(
            row.createRow(result.rowDef.title, result.items, openItem, { layout: layout })
          );
        }
        focus.focusDefaultMain();
      });
    })
    .catch(function (err) {
      el.innerHTML = "";
      var msg = err.message || String(err);
      if (msg.indexOf("401") !== -1) {
        showError(
          el,
          "TMDB API key is invalid. Open tizenflix-api/.env and set TMDB_API_KEY to your v3 API key (not the read access token), then restart the API."
        );
      } else if (msg.indexOf("503") !== -1 || msg.indexOf("TMDB") !== -1) {
        showError(
          el,
          "Catalog unavailable — set TMDB_API_KEY in tizenflix-api/.env and restart the API. " +
            "Browser: use Settings to point API URL to http://localhost:8790"
        );
      } else if (msg.indexOf("Failed to fetch") !== -1 || msg.indexOf("NetworkError") !== -1) {
        showError(
          el,
          "Cannot reach the API. In Settings set API URL to http://localhost:8790 (browser) or http://192.168.86.49:8790 (TV), then start: cd tizenflix-api && npm run api"
        );
      } else {
        showError(el, "Could not load catalog: " + msg);
      }
    });
}

function render(container) {
  row.resetRowCounter();
  var el = document.createElement("div");
  el.className = "screen screen-home";
  el.innerHTML = '<div class="loading-msg">Loading catalog…</div>';
  container.appendChild(el);
  loadContent(el);
}

module.exports = {
  setMode: setMode,
  render: render,
  onBrowseFocus: handleFocusChange,
};
