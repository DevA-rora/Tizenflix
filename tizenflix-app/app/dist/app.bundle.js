var TizenflixApp = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // app/js/config.js
  var require_config = __commonJS({
    "app/js/config.js"(exports, module) {
      var STORAGE_KEY = "tizenflix.apiBase";
      var DEFAULT_API = "http://192.168.86.11:8790";
      function getApiBase() {
        try {
          return localStorage.getItem(STORAGE_KEY) || DEFAULT_API;
        } catch (err) {
          return DEFAULT_API;
        }
      }
      function setApiBase(url) {
        var trimmed = (url || "").replace(/\/$/, "");
        try {
          localStorage.setItem(STORAGE_KEY, trimmed);
        } catch (err) {
        }
        return trimmed;
      }
      function fetchWithTimeout(url, ms) {
        return new Promise(function(resolve, reject) {
          var done = false;
          var timer = setTimeout(function() {
            if (done) return;
            done = true;
            reject(new Error("Request timed out after " + ms + "ms"));
          }, ms);
          fetch(url).then(function(res) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(res);
          }).catch(function(err) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            reject(err);
          });
        });
      }
      function checkHealth(apiBase) {
        return fetchWithTimeout(apiBase + "/health", 8e3).then(function(res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });
      }
      function resolveMovie(apiBase, tmdbId) {
        return fetchWithTimeout(apiBase + "/play/movie/" + tmdbId, 3e4).then(function(res) {
          if (!res.ok) {
            return res.text().then(function(text) {
              throw new Error("Play API " + res.status + (text ? ": " + text.slice(0, 120) : ""));
            });
          }
          return res.json();
        });
      }
      function pickPlayableSource(play) {
        if (!play || !play.sources || !play.sources.length) return null;
        if (play.recommended) {
          for (var i = 0; i < play.sources.length; i++) {
            if (play.sources[i].id === play.recommended) return play.sources[i];
          }
        }
        return play.sources[0];
      }
      function detectStreamType(url) {
        if (!url) return "unknown";
        var lower = url.toLowerCase();
        if (lower.indexOf(".m3u8") !== -1 || lower.indexOf("m3u8") !== -1) return "m3u8";
        if (lower.indexOf(".mp4") !== -1 || lower.indexOf(".webm") !== -1) return "mp4";
        return "unknown";
      }
      function logLine(container, message) {
        var el = document.createElement("div");
        var time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        el.textContent = "[" + time + "] " + message;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
      }
      module.exports = {
        STORAGE_KEY,
        DEFAULT_API,
        getApiBase,
        setApiBase,
        checkHealth,
        resolveMovie,
        pickPlayableSource,
        detectStreamType,
        logLine
      };
    }
  });

  // app/js/player.js
  var require_player = __commonJS({
    "app/js/player.js"(exports, module) {
      var config2 = require_config();
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
        var type = config2.detectStreamType(url);
        if (type === "m3u8" && window.Hls && Hls.isSupported()) {
          onLog("HLS.js -> " + url.slice(0, 80) + "...");
          hlsInstance = new Hls({ enableWorker: false });
          hlsInstance.loadSource(url);
          hlsInstance.attachMedia(video);
          hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
            onLog("Manifest parsed \u2014 starting playback");
            video.setAttribute("controls", "controls");
            showVideoWrap(videoWrap);
            video.play().catch(function(e) {
              onLog("Autoplay blocked: " + e.message);
            });
          });
          hlsInstance.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) onLog("HLS fatal: " + data.type + " / " + data.details);
          });
          return;
        }
        if (type === "m3u8" && video.canPlayType("application/vnd.apple.mpegurl")) {
          onLog("Native HLS");
          video.src = url;
          video.setAttribute("controls", "controls");
          showVideoWrap(videoWrap);
          video.play().catch(function(e) {
            onLog("Autoplay blocked: " + e.message);
          });
          return;
        }
        onLog("Direct URL (" + type + ")");
        video.src = url;
        video.setAttribute("controls", "controls");
        showVideoWrap(videoWrap);
        video.play().catch(function(e) {
          onLog("Autoplay blocked: " + e.message);
        });
      }
      module.exports = { destroyPlayer, playUrl, showVideoWrap };
    }
  });

  // app/js/focus.js
  var require_focus = __commonJS({
    "app/js/focus.js"(exports, module) {
      var FOCUS_SELECTOR = "button, input[type='text'], a, [tabindex='0']";
      function getFocusables(root) {
        var nodes = root.querySelectorAll(FOCUS_SELECTOR);
        var list = [];
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el.disabled) continue;
          if (el.offsetParent === null && el !== document.activeElement) continue;
          list.push(el);
        }
        return list;
      }
      function clearTvFocus(list) {
        for (var i = 0; i < list.length; i++) {
          list[i].classList.remove("tv-focus");
        }
      }
      function labelFor(el) {
        if (!el) return "";
        if (el.id === "apiBase") return "API URL";
        if (el.id === "saveApiBtn") return "Save & test";
        if (el.id === "playBtn") return "Play movie";
        if (el.id === "stopBtn") return "Stop";
        return el.textContent || el.tagName;
      }
      function setupFocus(root, onFocusChange) {
        var index = 0;
        function setFocus(i) {
          var list = getFocusables(root);
          if (!list.length) return;
          clearTvFocus(list);
          index = (i % list.length + list.length) % list.length;
          var el = list[index];
          el.classList.add("tv-focus");
          if (onFocusChange) onFocusChange(labelFor(el));
        }
        setFocus(0);
        document.addEventListener("keydown", function(e) {
          var list = getFocusables(root);
          if (!list.length) return;
          var key = e.key || "";
          var code = e.keyCode;
          if (key === "ArrowLeft" || code === 37) {
            setFocus(index - 1);
            e.preventDefault();
          } else if (key === "ArrowRight" || code === 39) {
            setFocus(index + 1);
            e.preventDefault();
          } else if (key === "ArrowUp" || code === 38) {
            setFocus(index - 1);
            e.preventDefault();
          } else if (key === "ArrowDown" || code === 40) {
            setFocus(index + 1);
            e.preventDefault();
          } else if (code === 13 || key === "Enter") {
            var focused = list[index];
            if (focused && focused.click) focused.click();
            e.preventDefault();
          } else if (code === 10009 || key === "Back" || key === "XF86Back") {
            e.preventDefault();
          }
        });
        return { setFocus };
      }
      module.exports = { setupFocus, getFocusables };
    }
  });

  // app/js/main.js
  var config = require_config();
  var player = require_player();
  var focus = require_focus();
  var TEST_TMDB_ID = "27205";
  function markCheck(el, pass) {
    el.classList.remove("pass", "fail");
    el.classList.add(pass ? "pass" : "fail");
    var text = el.textContent.replace(/^[✓✗]\s*/, "");
    el.textContent = (pass ? "\u2713 " : "\u2717 ") + text;
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
      back: document.getElementById("check-back")
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
        function(data) {
          healthDbg("OK \u2014 " + JSON.stringify(data));
          markCheck(checks.health, true);
          setBanner(banner, "ok", "API reachable \u2014 press Play movie.");
          return base;
        },
        function(err) {
          healthDbg("FAILED \u2014 " + err.message);
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
    document.getElementById("saveApiBtn").addEventListener("click", function() {
      testApi().catch(function() {
      });
    });
    playBtn.addEventListener("click", function() {
      playerLog.innerHTML = "";
      playBtn.disabled = true;
      setBanner(banner, "info", "Resolving stream...");
      testApi().then(function(base) {
        playerDbg("GET /play/movie/" + TEST_TMDB_ID);
        return config.resolveMovie(base, TEST_TMDB_ID);
      }).then(function(play) {
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
        setBanner(banner, "ok", "Playing \u2014 " + (play.title || "movie"));
        video.onplaying = function() {
          markCheck(checks.video, true);
        };
        video.onwaiting = function() {
          playerDbg("Buffering...");
        };
        video.onerror = function() {
          markCheck(checks.video, false);
          playerDbg("Video element error");
        };
        var progressed = false;
        video.ontimeupdate = function() {
          if (!progressed && video.currentTime > 1) {
            progressed = true;
            markCheck(checks.hls, true);
          }
        };
      }).catch(function(err) {
        setBanner(banner, "err", err.message);
        playerDbg("ERROR \u2014 " + err.message);
      }).then(function() {
        playBtn.disabled = false;
      });
    });
    stopBtn.addEventListener("click", function() {
      player.destroyPlayer();
      video.removeAttribute("src");
      video.removeAttribute("controls");
      video.load();
      if (videoWrap) videoWrap.classList.remove("is-visible");
      playerDbg("Stopped");
    });
    document.addEventListener("keydown", function(e) {
      if (e.keyCode === 10009 || e.key === "Back") {
        markCheck(checks.back, true);
      }
    });
    focus.setupFocus(document.body, updateFocusHint);
    testApi().catch(function() {
      setBanner(banner, "warn", "Enter your API LAN URL above, then Save & test.");
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
