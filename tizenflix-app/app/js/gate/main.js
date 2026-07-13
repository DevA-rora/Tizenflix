var config = require("../core/config.js");
var player = require("../player/player.js");
var focus = require("../core/focus.js");
var debug = require("../core/debug.js");
var keys = require("../core/keys.js");

var TEST_MOVIE_TMDB_ID = "27205";
var OFF_CAMPUS_TMDB_ID = "273240";
var OFF_CAMPUS_SEASON = 1;

function markCheck(el, pass) {
  if (!el) return;
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
  var playPauseBtn = document.getElementById("playPauseBtn");
  var testMp4Btn = document.getElementById("testMp4Btn");
  var testHlsBtn = document.getElementById("testHlsBtn");
  var playTvS1E1Btn = document.getElementById("playTvS1E1Btn");
  var playTvS1E2Btn = document.getElementById("playTvS1E2Btn");
  var playTvS1E3Btn = document.getElementById("playTvS1E3Btn");
  var focusHint = document.getElementById("focusHint");
  var jsStatus = document.getElementById("jsStatus");

  var testButtons = [
    playBtn,
    testMp4Btn,
    testHlsBtn,
    playTvS1E1Btn,
    playTvS1E2Btn,
    playTvS1E3Btn,
  ];

  if (jsStatus) {
    jsStatus.textContent = "JavaScript loaded";
    jsStatus.style.color = "#46d369";
  }

  debug.debugClear();
  debug.debugLog("Tizen TV: " + (player.isTizenTv() ? "yes" : "no"));
  debug.attachVideoDebug(video, playerDbg);

  var checks = {
    health: document.getElementById("check-health"),
    resolve: document.getElementById("check-resolve"),
    video: document.getElementById("check-video"),
    hls: document.getElementById("check-hls"),
    tv: document.getElementById("check-tv"),
    back: document.getElementById("check-back"),
  };
  var apiHealthy = false;

  function healthDbg(msg) {
    config.logLine(healthLog, msg);
  }

  function playerDbg(msg) {
    config.logLine(playerLog, msg);
    debug.debugLog(msg);
  }

  function updateFocusHint(label) {
    if (focusHint) focusHint.textContent = "Focused: " + label;
  }

  function setTestButtonsDisabled(disabled) {
    for (var i = 0; i < testButtons.length; i++) {
      if (testButtons[i]) testButtons[i].disabled = disabled;
    }
  }

  function wireVideoCallbacks(opts) {
    opts = opts || {};
    video.onplaying = function () {
      markCheck(checks.video, true);
      if (opts.onTvPlaying) opts.onTvPlaying();
    };
    video.onwaiting = function () {
      playerDbg("Buffering...");
    };
    video.onerror = function () {
      markCheck(checks.video, false);
      playerDbg("Video element error — " + debug.describeVideoError(video));
    };
    var progressed = false;
    video.ontimeupdate = function () {
      if (!progressed && video.currentTime > 1) {
        progressed = true;
        markCheck(checks.hls, true);
      }
    };
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
        apiHealthy = true;
        setBanner(banner, "ok", "API reachable.");
        return base;
      },
      function (err) {
        healthDbg("FAILED — " + err.message);
        markCheck(checks.health, false);
        apiHealthy = false;
        setBanner(
          banner,
          "err",
          "Cannot reach API. Is tizenflix-api running with PUBLIC_BASE set to your LAN IP?"
        );
        throw err;
      }
    );
  }

  function ensureApiReady() {
    if (apiHealthy) {
      return Promise.resolve(config.setApiBase(apiInput.value.trim() || config.getApiBase()));
    }
    return testApi();
  }

  function playResolvedContent(options) {
    playerLog.innerHTML = "";
    debug.debugClear();
    debug.debugLog("Starting: " + options.label);
    setTestButtonsDisabled(true);
    setBanner(banner, "info", "Resolving stream (this can take up to a minute)...");

    return ensureApiReady()
      .then(function (base) {
        var fullUrl = base + options.playPath;
        if (options.playQuery) {
          fullUrl += (fullUrl.indexOf("?") === -1 ? "?" : "&") + options.playQuery;
        }
        playerDbg("GET " + fullUrl);
        return options.resolve(base).then(function (play) {
          return { base: base, play: play };
        });
      })
      .then(function (result) {
        var play = result.play;
        var sources = config.listSourcesToTry(play);
        if (!sources.length) {
          markCheck(checks.resolve, false);
          var warn =
            play.warnings && play.warnings.length
              ? play.warnings.join("; ")
              : "No playable HLS sources";
          throw new Error(warn);
        }
        markCheck(checks.resolve, true);
        if (play.warnings && play.warnings.length) {
          for (var w = 0; w < play.warnings.length; w++) {
            playerDbg("API: " + play.warnings[w]);
          }
        }
        playerDbg("Sources to try: " + sources.length);
        wireVideoCallbacks(options.wireOpts || {});
        var title = play.title || options.defaultTitle || "Playback";
        player.playSources(video, sources, playerDbg, videoWrap, title);
        if (play.recommended) {
          setBanner(banner, "ok", "Playing — " + title);
        } else {
          setBanner(banner, "warn", "No verified sources — trying all streams anyway");
        }
      })
      .catch(function (err) {
        setBanner(banner, "err", err.message);
        playerDbg("ERROR — " + err.message);
      })
      .then(function () {
        setTestButtonsDisabled(false);
      });
  }

  function resolveMoviePlay(label) {
    var playPath = "/play/movie/" + TEST_MOVIE_TMDB_ID;
    return playResolvedContent({
      label: label,
      playPath: playPath,
      defaultTitle: "Inception",
      resolve: function (base) {
        return config.resolveMovie(base, TEST_MOVIE_TMDB_ID);
      },
    });
  }

  function resolveTvPlay(season, episode, label) {
    var playPath =
      "/play/tv/" + OFF_CAMPUS_TMDB_ID + "/" + season + "/" + episode;
    return playResolvedContent({
      label: label,
      playPath: playPath,
      defaultTitle: "Off Campus S" + season + "E" + episode,
      wireOpts: {
        onTvPlaying: function () {
          markCheck(checks.tv, true);
        },
      },
      resolve: function (base) {
        return config.resolveTvEpisode(
          base,
          OFF_CAMPUS_TMDB_ID,
          season,
          episode
        );
      },
    });
  }

  document.getElementById("saveApiBtn").addEventListener("click", function () {
    testApi().catch(function () {});
  });

  playBtn.addEventListener("click", function () {
    resolveMoviePlay("Play movie");
  });

  if (playTvS1E1Btn) {
    playTvS1E1Btn.addEventListener("click", function () {
      resolveTvPlay(OFF_CAMPUS_SEASON, 1, "Off Campus S1E1");
    });
  }

  if (playTvS1E2Btn) {
    playTvS1E2Btn.addEventListener("click", function () {
      resolveTvPlay(OFF_CAMPUS_SEASON, 2, "Off Campus S1E2");
    });
  }

  if (playTvS1E3Btn) {
    playTvS1E3Btn.addEventListener("click", function () {
      resolveTvPlay(OFF_CAMPUS_SEASON, 3, "Off Campus S1E3");
    });
  }

  if (testHlsBtn) {
    testHlsBtn.addEventListener("click", function () {
      playerLog.innerHTML = "";
      debug.debugClear();
      debug.debugLog("Test LAN HLS");
      setBanner(banner, "info", "Loading LAN sample HLS...");

      testApi()
        .then(function (base) {
          var url = base + "/test/sample.m3u8";
          playerDbg("HLS URL: " + url);
          wireVideoCallbacks();
          player.playUrl(video, url, playerDbg, videoWrap, "LAN sample HLS", "m3u8");
          setBanner(banner, "ok", "Playing LAN sample HLS — use Play/Pause if needed");
        })
        .catch(function (err) {
          setBanner(banner, "err", err.message);
          playerDbg("ERROR — " + err.message);
        });
    });
  }

  if (testMp4Btn) {
    testMp4Btn.addEventListener("click", function () {
      playerLog.innerHTML = "";
      debug.debugClear();
      debug.debugLog("Test LAN MP4");
      setBanner(banner, "info", "Loading LAN sample MP4...");

      testApi()
        .then(function (base) {
          var url = base + "/test/sample.mp4";
          playerDbg("MP4 URL: " + url);
          wireVideoCallbacks();
          player.playDirect(video, url, playerDbg, videoWrap, "LAN sample MP4", false);
          setBanner(banner, "ok", "Playing LAN sample MP4 — use Play/Pause if needed");
        })
        .catch(function (err) {
          setBanner(banner, "err", err.message);
          playerDbg("ERROR — " + err.message);
        });
    });
  }

  function stopPlayback() {
    player.destroyPlayer(video);
    video.removeAttribute("controls");
    video.removeAttribute("crossorigin");
    player.exitPlaybackMode();
    playerDbg("Stopped");
    setBanner(banner, "info", "Stopped — run a test again.");
  }

  stopBtn.addEventListener("click", stopPlayback);

  var stopBtnBar = document.getElementById("stopBtnBar");
  if (stopBtnBar) stopBtnBar.addEventListener("click", stopPlayback);

  function togglePlayPause() {
    player.togglePlayPause(video, playerDbg);
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", togglePlayPause);
  }

  document.addEventListener("keydown", function (e) {
    if (keys.isBackKey(e)) {
      markCheck(checks.back, true);
    }
    if (player.isMediaPlayPauseKey(e)) {
      togglePlayPause();
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
