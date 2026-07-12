import { detectStreamType } from "./config.js";

let hlsInstance = null;

export function destroyPlayer() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
}

/**
 * @param {HTMLVideoElement} video
 * @param {string} url
 * @param {(msg: string) => void} onLog
 */
export function playUrl(video, url, onLog) {
  destroyPlayer();
  const type = detectStreamType(url);

  if (type === "m3u8" && window.Hls && Hls.isSupported()) {
    onLog("HLS.js → " + url.slice(0, 80) + "…");
    hlsInstance = new Hls({ enableWorker: false });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      onLog("Manifest parsed — starting playback");
      video.play().catch((e) => onLog("Autoplay blocked: " + e.message));
    });
    hlsInstance.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) onLog("HLS fatal: " + data.type + " / " + data.details);
    });
    return;
  }

  if (type === "m3u8" && video.canPlayType("application/vnd.apple.mpegurl")) {
    onLog("Native HLS");
    video.src = url;
    video.play().catch((e) => onLog("Autoplay blocked: " + e.message));
    return;
  }

  onLog("Direct URL (" + type + ")");
  video.src = url;
  video.play().catch((e) => onLog("Autoplay blocked: " + e.message));
}
