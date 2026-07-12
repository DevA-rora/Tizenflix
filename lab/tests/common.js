window.TizenflixTestConfig = {
  streamApiBase: "http://localhost:8787",
  subtitleProxyBase: "http://localhost:8788",
};

/** Public demo streams — no API keys or Docker required */
window.TizenflixDemoStreams = [
  {
    title: "Big Buck Bunny (MP4)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    type: "mp4",
    provider: "demo",
  },
  {
    title: "Mux test stream (HLS)",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    type: "m3u8",
    provider: "demo",
  },
];

async function checkServiceHealth(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

function renderDemoStreams(container, onPlay) {
  window.TizenflixDemoStreams.forEach(function (s) {
    var li = document.createElement("li");
    var type = s.type || detectStreamType(s.url);
    li.innerHTML =
      "<strong>" + s.title + "</strong> " +
      '<span class="badge badge-' + (type === "m3u8" ? "m3u8" : "mp4") + '">' + type + "</span><br>" +
      "<span style='color:var(--muted);font-size:0.85rem'>No API keys required</span>";
    var btn = document.createElement("button");
    btn.textContent = "Play in custom player";
    btn.style.marginTop = "0.5rem";
    btn.addEventListener("click", function () {
      onPlay(s);
    });
    li.appendChild(btn);
    container.appendChild(li);
  });
}

function detectStreamType(url) {
  if (!url) return "unknown";
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8") || lower.includes("m3u8")) return "m3u8";
  if (lower.includes(".mp4") || lower.includes(".webm") || lower.includes(".mkv")) return "mp4";
  return "unknown";
}

function logLine(container, message, className) {
  const el = document.createElement("div");
  if (className) el.className = className;
  const time = new Date().toLocaleTimeString();
  el.textContent = "[" + time + "] " + message;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function parsePlayerMessage(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return { raw: data };
    }
  }
  return data;
}

function formatPlayerEvent(payload) {
  if (payload && payload.type === "PLAYER_EVENT" && payload.data) {
    const d = payload.data;
    return (
      "PLAYER_EVENT " +
      d.event +
      " | progress=" +
      (d.progress != null ? d.progress.toFixed(1) + "%" : "?") +
      " | t=" +
      (d.currentTime != null ? Math.floor(d.currentTime) : "?") +
      "s"
    );
  }
  if (payload && payload.raw) return "raw: " + payload.raw;
  return JSON.stringify(payload);
}

async function fetchStreams(type, tmdbId, season, episode) {
  let path = "/api/streams/" + type + "/" + tmdbId;
  if (type === "series" && season != null && episode != null) {
    path += "?season=" + season + "&episode=" + episode;
  }
  const res = await fetch(window.TizenflixTestConfig.streamApiBase + path);
  if (!res.ok) {
    throw new Error("Stream API " + res.status + ": " + (await res.text()));
  }
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data.streams && Array.isArray(data.streams)) return data.streams;
  if (data.results && Array.isArray(data.results)) return data.results;
  return [];
}

function setupBasicFocus(root) {
  const focusables = root.querySelectorAll(
    "button, a, input, select, [tabindex='0']"
  );
  let index = 0;
  function setFocus(i) {
    focusables.forEach(function (el) {
      el.classList.remove("focused");
    });
    index = ((i % focusables.length) + focusables.length) % focusables.length;
    const el = focusables[index];
    if (el) {
      el.focus();
      el.classList.add("focused");
    }
  }
  setFocus(0);
  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 37 || e.key === "ArrowLeft") {
      setFocus(index - 1);
      e.preventDefault();
    } else if (e.keyCode === 39 || e.key === "ArrowRight") {
      setFocus(index + 1);
      e.preventDefault();
    } else if (e.keyCode === 38 || e.key === "ArrowUp") {
      setFocus(index - 1);
      e.preventDefault();
    } else if (e.keyCode === 40 || e.key === "ArrowDown") {
      setFocus(index + 1);
      e.preventDefault();
    }
  });
}
