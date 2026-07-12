var config = require("./config.js");

var hlsInstance = null;

function destroyPlayer() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
}

function showVideoWrap(wrap) {
  if (wrap) wrap.classList.add("is-visible");
}

function playUrl(video, url, onLog, videoWrap) {
  destroyPlayer();
  var type = config.detectStreamType(url);

  if (type === "m3u8" && window.Hls && Hls.isSupported()) {
    onLog("HLS.js -> " + url.slice(0, 80) + "...");
    hlsInstance = new Hls({ enableWorker: false });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
      onLog("Manifest parsed — starting playback");
      video.setAttribute("controls", "controls");
      showVideoWrap(videoWrap);
      video.play().catch(function (e) {
        onLog("Autoplay blocked: " + e.message);
      });
    });
    hlsInstance.on(Hls.Events.ERROR, function (event, data) {
      if (data.fatal) onLog("HLS fatal: " + data.type + " / " + data.details);
    });
    return;
  }

  if (type === "m3u8" && video.canPlayType("application/vnd.apple.mpegurl")) {
    onLog("Native HLS");
    video.src = url;
    video.setAttribute("controls", "controls");
    showVideoWrap(videoWrap);
    video.play().catch(function (e) {
      onLog("Autoplay blocked: " + e.message);
    });
    return;
  }

  onLog("Direct URL (" + type + ")");
  video.src = url;
  video.setAttribute("controls", "controls");
  showVideoWrap(videoWrap);
  video.play().catch(function (e) {
    onLog("Autoplay blocked: " + e.message);
  });
}

module.exports = { destroyPlayer: destroyPlayer, playUrl: playUrl, showVideoWrap: showVideoWrap };
