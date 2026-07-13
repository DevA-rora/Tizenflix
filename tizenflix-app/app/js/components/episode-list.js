/**
 * TV episode list — season tabs + episode cards for series detail.
 */

var api = require("../services/api.js");

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + "…";
}

function formatRuntime(minutes) {
  if (!minutes || minutes <= 0) return "";
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  if (h > 0 && m > 0) return h + "h " + m + "m";
  if (h > 0) return h + "h";
  return m + "m";
}

function create(options) {
  options = options || {};
  var tmdbId = options.tmdbId;
  var showTitle = options.showTitle || "";
  var titleMeta = options.titleMeta || {};
  var onEpisodeSelect = options.onEpisodeSelect;
  var onSeasonChange = options.onSeasonChange;
  var selectedSeason = options.initialSeason || 1;

  var section = document.createElement("section");
  section.className = "detail-episodes-section";

  var seasonsRow = document.createElement("div");
  seasonsRow.className = "season-tabs";
  seasonsRow.setAttribute("data-focus-row", "detail-seasons");

  var episodesRow = document.createElement("div");
  episodesRow.className = "episode-list";
  episodesRow.setAttribute("data-focus-row", "detail-episodes");

  section.appendChild(seasonsRow);
  section.appendChild(episodesRow);

  function getSelectedSeasonTabIndex() {
    var tabs = seasonsRow.querySelectorAll(".season-tab");
    for (var i = 0; i < tabs.length; i++) {
      if (parseInt(tabs[i].getAttribute("data-season"), 10) === selectedSeason) {
        return i;
      }
    }
    return 0;
  }

  function renderSeasonTabs(seasons) {
    seasonsRow.innerHTML = "";
    if (!seasons.length) {
      seasonsRow.style.display = "none";
      return;
    }
    seasonsRow.style.display = "";

    for (var i = 0; i < seasons.length; i++) {
      (function (season) {
        var tab = document.createElement("button");
        tab.type = "button";
        tab.className =
          "season-tab focusable" + (season.season === selectedSeason ? " is-active" : "");
        tab.setAttribute("data-season", String(season.season));
        tab.setAttribute("aria-label", "Season " + season.season);
        tab.setAttribute("data-cross-down", "detail-episodes");
        tab.setAttribute("data-cross-down-col", "0");
        tab.textContent = "Season " + season.season;
        tab.addEventListener("click", function () {
          selectSeason(season.season);
        });
        seasonsRow.appendChild(tab);
      })(seasons[i]);
    }
  }

  function updateSeasonTabStates() {
    var tabs = seasonsRow.querySelectorAll(".season-tab");
    for (var i = 0; i < tabs.length; i++) {
      var season = parseInt(tabs[i].getAttribute("data-season"), 10);
      if (season === selectedSeason) {
        tabs[i].classList.add("is-active");
      } else {
        tabs[i].classList.remove("is-active");
      }
    }
  }

  function selectSeason(season) {
    if (season === selectedSeason) return;
    selectedSeason = season;
    updateSeasonTabStates();
    if (onSeasonChange) onSeasonChange(season);
    loadEpisodes();
  }

  function renderEpisodes(episodes) {
    episodesRow.innerHTML = "";

    var heading = document.createElement("h3");
    heading.className = "episode-list-heading";
    heading.textContent = "Episodes";
    episodesRow.appendChild(heading);

    if (!episodes.length) {
      var empty = document.createElement("p");
      empty.className = "loading-msg";
      empty.textContent = "No episodes found.";
      episodesRow.appendChild(empty);
      return;
    }

    var list = document.createElement("div");
    list.className = "episode-list-items";
    var seasonTabIndex = getSelectedSeasonTabIndex();

    for (var i = 0; i < episodes.length; i++) {
      (function (ep, episodeIndex) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "episode-item focusable";
        btn.setAttribute(
          "aria-label",
          "Episode " + ep.episode + ": " + (ep.title || "Episode")
        );
        if (episodeIndex === 0) {
          btn.setAttribute("data-cross-up", "detail-seasons");
          btn.setAttribute("data-cross-up-col", String(seasonTabIndex));
        }

        var still = ep.still
          ? ' style="background-image:url(\'' + escapeHtml(ep.still) + '\')"'
          : "";
        var runtime = formatRuntime(ep.runtime);

        btn.innerHTML =
          '<div class="episode-thumb"' +
          still +
          "></div>" +
          '<div class="episode-meta">' +
          '<div class="episode-meta-top">' +
          "<strong>" +
          ep.episode +
          ". " +
          escapeHtml(ep.title || "Episode") +
          "</strong>" +
          (runtime ? '<span class="episode-runtime">' + escapeHtml(runtime) + "</span>" : "") +
          "</div>" +
          '<span class="episode-overview">' +
          escapeHtml(truncate(ep.overview || "", 160)) +
          "</span>" +
          "</div>";

        btn.addEventListener("click", function () {
          if (onEpisodeSelect) {
            onEpisodeSelect(ep.season, ep.episode, ep);
          }
        });
        list.appendChild(btn);
      })(episodes[i], i);
    }

    episodesRow.appendChild(list);
  }

  function loadEpisodes() {
    episodesRow.innerHTML = '<div class="loading-msg">Loading episodes…</div>';

    api
      .getEpisodes(tmdbId, selectedSeason)
      .then(function (data) {
        renderEpisodes(data.episodes || []);
      })
      .catch(function (err) {
        episodesRow.innerHTML =
          '<div class="error-banner">' + escapeHtml(err.message) + "</div>";
      });
  }

  function initWithSeasons(seasons) {
    var filtered = (seasons || []).filter(function (s) {
      return s.episodeCount > 0;
    });

    if (filtered.length) {
      var hasSeason = false;
      for (var i = 0; i < filtered.length; i++) {
        if (filtered[i].season === selectedSeason) {
          hasSeason = true;
          break;
        }
      }
      if (!hasSeason) selectedSeason = filtered[0].season;
    }

    renderSeasonTabs(filtered);
    loadEpisodes();
  }

  function startLoading() {
    seasonsRow.innerHTML = '<div class="loading-msg">Loading seasons…</div>';
    episodesRow.innerHTML = '<div class="loading-msg">Loading episodes…</div>';

    if (options.seasons && options.seasons.length) {
      initWithSeasons(options.seasons);
    } else {
      api
        .getSeasons(tmdbId)
        .then(function (data) {
          initWithSeasons(data.seasons || []);
        })
        .catch(function () {
          seasonsRow.innerHTML = "";
          seasonsRow.style.display = "none";
          loadEpisodes();
        });
    }
  }

  section.selectSeason = selectSeason;
  section.getSelectedSeason = function () {
    return selectedSeason;
  };
  section.load = function () {
    if (section._loaded) return;
    section._loaded = true;
    startLoading();
  };

  if (options.lazy) {
    seasonsRow.innerHTML = "";
    episodesRow.innerHTML = "";
  } else {
    startLoading();
  }

  return section;
}

module.exports = {
  create: create,
};
