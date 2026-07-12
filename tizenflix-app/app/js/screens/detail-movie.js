/**
 * Movie detail — backdrop, synopsis, Play.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var playback = require("../services/playback.js");

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
      var meta = [];
      if (title.year) meta.push(title.year);
      if (title.runtime) meta.push(title.runtime + " min");
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
        '<div class="detail-actions">' +
        '<button type="button" class="btn btn-play focusable" id="detailPlayBtn">▶ Play</button>' +
        '<button type="button" class="btn btn-info focusable" id="detailBackBtn">← Back</button>' +
        "</div>" +
        "</div></div>";

      var playBtn = el.querySelector("#detailPlayBtn");
      var backBtn = el.querySelector("#detailBackBtn");

      playBtn.addEventListener("click", function () {
        playback.playMovie(title.id, title.title, status).catch(function (err) {
          if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
        });
      });

      backBtn.addEventListener("click", function () {
        router.back();
      });
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
  render: render,
};
