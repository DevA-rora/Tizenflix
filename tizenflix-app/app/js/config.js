const STORAGE_KEY = "tizenflix.apiBase";
const DEFAULT_API = "http://localhost:8790";

export function getApiBase() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_API;
  } catch {
    return DEFAULT_API;
  }
}

export function setApiBase(url) {
  const trimmed = url.replace(/\/$/, "");
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    /* TV may block storage in some modes */
  }
  return trimmed;
}

export async function checkHealth(apiBase) {
  const res = await fetch(apiBase + "/health", {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

export async function resolveMovie(apiBase, tmdbId) {
  const res = await fetch(apiBase + "/play/movie/" + tmdbId, {
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Play API " + res.status + (text ? ": " + text.slice(0, 120) : ""));
  }
  return res.json();
}

export function pickPlayableSource(play) {
  if (!play?.sources?.length) return null;
  if (play.recommended) {
    const rec = play.sources.find((s) => s.id === play.recommended);
    if (rec) return rec;
  }
  return play.sources[0];
}

export function detectStreamType(url) {
  if (!url) return "unknown";
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8") || lower.includes("m3u8")) return "m3u8";
  if (lower.includes(".mp4") || lower.includes(".webm")) return "mp4";
  return "unknown";
}

export function logLine(container, message) {
  const el = document.createElement("div");
  const time = new Date().toLocaleTimeString();
  el.textContent = "[" + time + "] " + message;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}
