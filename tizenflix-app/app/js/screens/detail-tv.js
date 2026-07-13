/**
 * TV series detail — Netflix-style hero, episode list, Play.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var focus = require("../core/focus.js");
var playback = require("../services/playback.js");
var detailHero = require("../components/detail-hero.js");

var params = {};
var selectedSeason = 1;

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function onEnter(p) {
  params = p || {};
  selectedSeason = (p && p.season) || 1;
}

function onLeave() {
  detailHero.stopBackgroundVideo();
}

function buildMetaLine(title, season) {
  var parts = [];
  if (season) parts.push("Season " + season);
  if (title.year) parts.push(String(title.year));
  if (title.genres && title.genres.length) parts.push(title.genres[0]);
  if (title.certification) parts.push(title.certification);
  return parts.join(" · ");
}

function playEpisode(tmdbId, season, episode, showTitle, ep, titleMeta, onStatus) {
  var label = showTitle + " S" + season + "E" + episode;
  var meta = {
    showTitle: showTitle,
    episodeTitle: ep && ep.title ? ep.title : "",
    overview: ep && ep.overview ? ep.overview : "",
    metaLine: titleMeta ? buildMetaLine(titleMeta, season) : "",
  };
  playback.playTvEpisode(tmdbId, season, episode, label, onStatus, meta).catch(function (err) {
    if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
  });
}

function renderEpisodes(el, tmdbId, showTitle, titleMeta, onStatus) {
  var listEl = el.querySelector(".episode-list");
  if (!listEl) return;
  listEl.innerHTML = "<h3>Season " + selectedSeason + "</h3><div class=\"loading-msg\">Loading episodes…</div>";

  api
    .getEpisodes(tmdbId, selectedSeason)
    .then(function (data) {
      var episodes = data.episodes || [];
      listEl.innerHTML = "<h3>Season " + selectedSeason + "</h3>";
      if (!episodes.length) {
        listEl.innerHTML += '<p class="loading-msg">No episodes found.</p>';
        return;
      }

      for (var i = 0; i < episodes.length; i++) {
        (function (ep) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "episode-item focusable";
          btn.setAttribute("data-focus-row", "detail-episodes");
          btn.innerHTML =
            "<strong>E" +
            ep.episode +
            ": " +
            escapeHtml(ep.title) +
            "</strong><span>" +
            escapeHtml(ep.overview || "") +
            "</span>";
          btn.addEventListener("click", function () {
            playEpisode(tmdbId, ep.season, ep.episode, showTitle, ep, titleMeta, onStatus);
          });
          listEl.appendChild(btn);
        })(episodes[i]);
      }
    })
    .catch(function (err) {
      listEl.innerHTML =
        "<h3>Season " +
        selectedSeason +
        '</h3><div class="error-banner">' +
        escapeHtml(err.message) +
        "</div>";
    });
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-detail screen-detail-tv";
  el.innerHTML = '<div class="loading-msg">Loading…</div>';
  container.appendChild(el);

  if (!params.tmdbId) {
    el.innerHTML = '<div class="error-banner">Missing series ID</div>';
    return;
  }

  function status(msg) {
    if (window.TizenflixApp) window.TizenflixApp.showStatus(msg, false);
  }

  api
    .getTv(params.tmdbId)
    .then(function (title) {
      el.innerHTML = "";

      api.getEpisodes(title.id, 1).then(function (epData) {
        var firstEp = (epData.episodes && epData.episodes[0]) || null;
        var hero = detailHero.render(title, {
          playLabel: "▶ Play S1E1",
          onBack: function () {
            router.back();
          },
          onPlay: function () {
            playEpisode(title.id, 1, 1, title.title, firstEp, title, status);
          },
        });
        el.appendChild(hero);

        playback.prefetchTvEpisode(title.id, 1, 1);

        var episodeList = document.createElement("div");
        episodeList.className = "episode-list";
        el.appendChild(episodeList);

        var playBtn = el.querySelector("#detailPlayBtn");
        if (playBtn) focus.focusElement(playBtn);

        renderEpisodes(el, title.id, title.title, title, status);
      }).catch(function () {
        var hero = detailHero.render(title, {
          playLabel: "▶ Play S1E1",
          onBack: function () {
            router.back();
          },
          onPlay: function () {
            playEpisode(title.id, 1, 1, title.title, null, title, status);
          },
        });
        el.appendChild(hero);
        playback.prefetchTvEpisode(title.id, 1, 1);
        var episodeList = document.createElement("div");
        episodeList.className = "episode-list";
        el.appendChild(episodeList);
        renderEpisodes(el, title.id, title.title, title, status);
      });
    })
    .catch(function (err) {
      el.innerHTML =
        '<div class="error-banner">Failed to load series: ' + escapeHtml(err.message) + "</div>";
    });
}

module.exports = {
  onEnter: onEnter,
  onLeave: onLeave,
  render: render,
};
