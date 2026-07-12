var config = require("./config.js");
var player = require("./player.js");
var focus = require("./focus.js");

var TEST_TMDB_ID = "27205";

function markCheck(el, pass) {
  el.classList.remove("pass", "fail");
  el.classList.add(pass ? "pass" : "fail");
  var text = el.textContent.replace(/^[✓✗]\s*/, "");
  el.textContent = (pass ? "✓ " : "✗ ") + text;
}

function setBanner(banner, kind, text) {
  banner.className = "status " + kind;
  banner.textContent = text;
}

function init() {
  var banner = document.getElementById("banner");
  var apiInput = document.getElementById("apiBase");
  var healthLog = document.getElementById("healthLog");
  var playerLog = document.getElementById("playerLog");
  var video = document.getElementById("video");
  var videoWrap = document.getElementById("videoWrap");
  var playBtn = document.getElementById("playBtn");
  var stopBtn = document.getElementById("stopBtn");
  var focusHint = document.getElementById("focusHint");
  var jsStatus = document.getElementById("jsStatus");

  if (jsStatus) {
    jsStatus.textContent = "JavaScript loaded";
    jsStatus.style.color = "#46d369";
  }

  var checks = {
    health: document.getElementById("check-health"),
    resolve: document.getElementById("check-resolve"),
    video: document.getElementById("check-video"),
    hls: document.getElementById("check-hls"),
    back: document.getElementById("check-back"),
  };

  function healthDbg(msg) {
    config.logLine(healthLog, msg);
  }

  function playerDbg(msg) {
    config.logLine(playerLog, msg);
  }

  function updateFocusHint(label) {
    if (focusHint) focusHint.textContent = "Focused: " + label;
  }

  apiInput.value = config.getApiBase();

  function testApi() {
    var base = config.setApiBase(apiInput.value.trim() || config.getApiBase());
    healthLog.innerHTML = "";
    healthDbg("Testing " + base + "/health ...");
    setBanner(banner, "info", "Checking API...");

    return config.checkHealth(base).then(
      function (data) {
        healthDbg("OK — " + JSON.stringify(data));
        markCheck(checks.health, true);
        setBanner(banner, "ok", "API reachable — press Play movie.");
        return base;
      },
      function (err) {
        healthDbg("FAILED — " + err.message);
        markCheck(checks.health, false);
        setBanner(
          banner,
          "err",
          "Cannot reach API. Is tizenflix-api running with PUBLIC_BASE set to your LAN IP?"
        );
        throw err;
      }
    );
  }

  document.getElementById("saveApiBtn").addEventListener("click", function () {
    testApi().catch(function () {});
  });

  playBtn.addEventListener("click", function () {
    playerLog.innerHTML = "";
    playBtn.disabled = true;
    setBanner(banner, "info", "Resolving stream...");

    testApi()
      .then(function (base) {
        playerDbg("GET /play/movie/" + TEST_TMDB_ID);
        return config.resolveMovie(base, TEST_TMDB_ID);
      })
      .then(function (play) {
        var source = config.pickPlayableSource(play);
        if (!source || !source.url) {
          markCheck(checks.resolve, false);
          throw new Error("No playable sources in response");
        }
        markCheck(checks.resolve, true);
        playerDbg(
          "Source: " + source.label + " (" + source.provider + ", " + source.type + ")"
        );
        if (play.subtitles && play.subtitles.length) {
          playerDbg("Subtitles available: " + play.subtitles.length);
        }

        player.playUrl(video, source.url, playerDbg, videoWrap);
        setBanner(banner, "ok", "Playing — " + (play.title || "movie"));

        video.onplaying = function () {
          markCheck(checks.video, true);
        };
        video.onwaiting = function () {
          playerDbg("Buffering...");
        };
        video.onerror = function () {
          markCheck(checks.video, false);
          playerDbg("Video element error");
        };

        var progressed = false;
        video.ontimeupdate = function () {
          if (!progressed && video.currentTime > 1) {
            progressed = true;
            markCheck(checks.hls, true);
          }
        };
      })
      .catch(function (err) {
        setBanner(banner, "err", err.message);
        playerDbg("ERROR — " + err.message);
      })
      .then(function () {
        playBtn.disabled = false;
      });
  });

  stopBtn.addEventListener("click", function () {
    player.destroyPlayer();
    video.removeAttribute("src");
    video.removeAttribute("controls");
    video.load();
    if (videoWrap) videoWrap.classList.remove("is-visible");
    playerDbg("Stopped");
  });

  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 10009 || e.key === "Back") {
      markCheck(checks.back, true);
    }
  });

  focus.setupFocus(document.body, updateFocusHint);

  testApi().catch(function () {
    setBanner(banner, "warn", "Enter your API LAN URL above, then Save & test.");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
