/**
 * TV series detail — Netflix-style hero, episode list, Play.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");
var focus = require("../core/focus.js");
var playback = require("../services/playback.js");
var detailHero = require("../components/detail-hero.js");
var episodeList = require("../components/episode-list.js");
var choreography = require("../core/choreography.js");

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

function playEpisode(tmdbId, season, episode, showTitle, ep, titleMeta, onStatus, extraMeta) {
  var label = showTitle + " S" + season + "E" + episode;
  var meta = {
    showTitle: showTitle,
    episodeTitle: ep && ep.title ? ep.title : "",
    overview: ep && ep.overview ? ep.overview : "",
    metaLine: titleMeta ? buildMetaLine(titleMeta, season) : "",
    poster: titleMeta && titleMeta.poster ? titleMeta.poster : null,
    backdrop:
      titleMeta && (titleMeta.backdrop || titleMeta.poster)
        ? titleMeta.backdrop || titleMeta.poster
        : null,
  };
  if (extraMeta) {
    for (var k in extraMeta) {
      if (Object.prototype.hasOwnProperty.call(extraMeta, k)) meta[k] = extraMeta[k];
    }
  }
  playback.playTvEpisode(tmdbId, season, episode, label, onStatus, meta).catch(function (err) {
    if (window.TizenflixApp) window.TizenflixApp.showStatus(err.message, true);
  });
}

function findResumeEntry(items, tmdbId) {
  var id = String(tmdbId);
  for (var i = 0; i < items.length; i++) {
    var entry = items[i];
    if (String(entry.tmdbId) === id && entry.type === "tv" && entry.season && entry.episode) {
      return entry;
    }
  }
  return null;
}

function renderHeroAndEpisodes(el, title, onStatus, resumeEntry) {
  var playSeason = 1;
  var playEpisodeNum = 1;
  var playLabel = "▶ Play S1E1";
  var startSeconds = 0;
  var initialSeason = selectedSeason;

  if (resumeEntry) {
    playSeason = resumeEntry.season;
    playEpisodeNum = resumeEntry.episode;
    playLabel = "▶ Resume S" + playSeason + "E" + playEpisodeNum;
    startSeconds = resumeEntry.positionSeconds || 0;
    initialSeason = playSeason;
    selectedSeason = playSeason;
  }

  function mountHero(firstEp) {
    var hero = detailHero.render(title, {
      playLabel: playLabel,
      onBack: function () {
        router.back();
      },
      onPlay: function () {
        playEpisode(
          title.id,
          playSeason,
          playEpisodeNum,
          title.title,
          firstEp,
          title,
          onStatus,
          startSeconds > 0 ? { startSeconds: startSeconds } : null
        );
      },
    });
    el.appendChild(hero);
    choreography.animateDetailContentIn(el);
    playback.prefetchTvEpisode(title.id, playSeason, playEpisodeNum);

    var listSection = episodeList.create({
      tmdbId: title.id,
      showTitle: title.title,
      titleMeta: title,
      initialSeason: initialSeason,
      onEpisodeSelect: function (season, episode, ep) {
        playEpisode(title.id, season, episode, title.title, ep, title, onStatus);
      },
      onSeasonChange: function (season) {
        selectedSeason = season;
      },
    });
    el.appendChild(listSection);

    var playBtn = el.querySelector("#detailPlayBtn");
    if (playBtn) focus.focusElement(playBtn);
  }

  api
    .getEpisodes(title.id, playSeason)
    .then(function (epData) {
      var episodes = epData.episodes || [];
      var targetEp = null;
      for (var i = 0; i < episodes.length; i++) {
        if (episodes[i].episode === playEpisodeNum) {
          targetEp = episodes[i];
          break;
        }
      }
      if (!targetEp && episodes.length) targetEp = episodes[0];
      mountHero(targetEp);
    })
    .catch(function () {
      mountHero(null);
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

  Promise.all([
    api.getTv(params.tmdbId),
    api.continueWatching(20).catch(function () {
      return [];
    }),
  ])
    .then(function (results) {
      var title = results[0];
      var cwItems = results[1] || [];
      el.innerHTML = "";
      var resumeEntry = findResumeEntry(cwItems, params.tmdbId);
      renderHeroAndEpisodes(el, title, status, resumeEntry);
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
