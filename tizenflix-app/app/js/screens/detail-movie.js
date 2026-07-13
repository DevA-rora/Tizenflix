/**
 * Movie detail — Netflix-style hero with Play.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var focus = require("../core/focus.js");
var playback = require("../services/playback.js");
var detailHero = require("../components/detail-hero.js");
var choreography = require("../core/choreography.js");

var params = {};

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function onEnter(p) {
  params = p || {};
}

function onLeave() {
  detailHero.stopBackgroundVideo();
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-detail screen-detail-movie";
  el.innerHTML = '<div class="loading-msg">Loading…</div>';
  container.appendChild(el);

  if (!params.tmdbId) {
    el.innerHTML = '<div class="error-banner">Missing movie ID</div>';
    return;
  }

  api
    .getMovie(params.tmdbId)
    .then(function (title) {
      el.innerHTML = "";

      var hero = detailHero.render(title, {
        playLabel: "▶ Play",
        onBack: function () {
          router.back();
        },
        onPlay: function () {
          playback
            .playMovie(title.id, title.title, status, {
              poster: title.poster || null,
              backdrop: title.backdrop || title.poster || null,
            })
            .catch(function (err) {
            if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
          });
        },
      });

      el.appendChild(hero);
      choreography.animateDetailContentIn(el);

      playback.prefetchMovie(params.tmdbId);

      var playBtn = el.querySelector("#detailPlayBtn");
      if (playBtn) focus.focusElement(playBtn);
    })
    .catch(function (err) {
      el.innerHTML =
        '<div class="error-banner">Failed to load movie: ' + escapeHtml(err.message) + "</div>";
    });

  function status(msg) {
    if (window.TizenflixApp) window.TizenflixApp.showStatus(msg, false);
  }
}

module.exports = {
  onEnter: onEnter,
  onLeave: onLeave,
  render: render,
};
