/**
 * TV series detail — seasons, episode list, Play.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var focus = require("../core/focus.js");
var playback = require("../services/playback.js");

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

function renderEpisodes(el, tmdbId, showTitle) {
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
          btn.innerHTML =
            "<strong>E" +
            ep.episode +
            ": " +
            escapeHtml(ep.title) +
            "</strong><span>" +
            escapeHtml(ep.overview || "") +
            "</span>";
          btn.addEventListener("click", function () {
            var label = showTitle + " S" + ep.season + "E" + ep.episode;
            playback.playTvEpisode(tmdbId, ep.season, ep.episode, label, status).catch(function (err) {
              if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
            });
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

  function status(msg) {
    if (window.TizenflixApp) window.TizenflixApp.showStatus(msg, false);
  }
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

  api
    .getTv(params.tmdbId)
    .then(function (title) {
      var meta = [];
      if (title.year) meta.push(title.year);
      if (title.rating) meta.push("★ " + title.rating.toFixed(1));

      el.innerHTML =
        '<div class="detail-hero">' +
        '<div class="detail-backdrop" style="background-image:url(\'' +
        escapeHtml(title.backdrop || title.poster || "") +
        '\')"></div>' +
        '<div class="detail-gradient"></div>' +
        '<div class="detail-content">' +
        "<h1 class=\"detail-title\">" +
        escapeHtml(title.title) +
        "</h1>" +
        '<p class="detail-meta">' +
        escapeHtml(meta.join(" · ")) +
        "</p>" +
        '<p class="detail-overview">' +
        escapeHtml(title.overview || "") +
        "</p>" +
        '<div class="detail-actions" data-focus-row="detail-actions">' +
        '<button type="button" class="btn btn-play focusable" id="detailPlayBtn">▶ Play S1E1</button>' +
        '<button type="button" class="btn btn-info focusable" id="detailBackBtn">← Back</button>' +
        "</div>" +
        "</div></div>" +
        '<div class="episode-list"></div>';

      var playBtn = el.querySelector("#detailPlayBtn");
      var backBtn = el.querySelector("#detailBackBtn");

      playBtn.addEventListener("click", function () {
        playback
          .playTvEpisode(title.id, 1, 1, title.title + " S1E1", status)
          .catch(function (err) {
            if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
          });
      });

      backBtn.addEventListener("click", function () {
        router.back();
      });

      focus.focusElement(playBtn);
      renderEpisodes(el, title.id, title.title);
    })
    .catch(function (err) {
      el.innerHTML =
        '<div class="error-banner">Failed to load series: ' + escapeHtml(err.message) + "</div>";
    });

  function status(msg) {
    if (window.TizenflixApp) window.TizenflixApp.showStatus(msg, false);
  }
}

module.exports = {
  onEnter: onEnter,
  render: render,
};
