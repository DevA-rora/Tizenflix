/**
 * Full-screen player screen (stub) — wraps player.js.
 */

var player = require("../player/player.js");
var api = require("../services/api.js");

var params = {};

function onEnter(p) {
  params = p || {};
}

function onLeave() {
  var video = document.getElementById("video");
  if (video) player.destroyPlayer(video);
  player.exitPlaybackMode();
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-player";
  el.innerHTML =
    '<div class="screen-placeholder">' +
    "<h2>Player</h2>" +
    "<p>Fullscreen playback chrome will mount here.</p>" +
    "</div>";
  container.appendChild(el);
}

module.exports = {
  onEnter: onEnter,
  onLeave: onLeave,
  render: render,
  play: function (playResponse, title) {
    var video = document.getElementById("video");
    var wrap = document.getElementById("videoWrap");
    if (!video || !wrap) return;
    wrap.classList.remove("hidden");
    var sources = api.sourcesForPlay(playResponse);
    player.playSources(video, sources, null, wrap, title || playResponse.title);
  },
};
