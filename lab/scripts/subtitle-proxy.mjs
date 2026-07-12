#!/usr/bin/env node
/**
 * Tiny CORS proxy for OpenSubtitles + TMDB subtitle lookup.
 * Run: node scripts/subtitle-proxy.mjs
 * Listens on http://localhost:8788
 *
 * Requires .env with TMDB_API_KEY and OPENSUBTITLES_API_KEY
 */

import http from "http";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SUBTITLE_PROXY_PORT || 8788);

function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const TMDB_KEY = process.env.TMDB_API_KEY;
const OS_KEY = process.env.OPENSUBTITLES_API_KEY;
const USER_AGENT = "Tizenflix Test Harness 1.0";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function tmdbToImdb(tmdbId, type) {
  if (!TMDB_KEY) throw new Error("TMDB_API_KEY not set in .env");
  const endpoint =
    type === "series"
      ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}`
      : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error("TMDB lookup failed: " + res.status);
  const data = await res.json();
  const imdb = data.imdb_id;
  if (!imdb) throw new Error("No imdb_id on TMDB record");
  return imdb.replace(/^tt/, "");
}

async function searchOpenSubtitles(imdbNumeric, season, episode) {
  if (!OS_KEY) throw new Error("OPENSUBTITLES_API_KEY not set in .env");
  const params = new URLSearchParams({ imdb_id: imdbNumeric });
  if (season != null) params.set("season_number", String(season));
  if (episode != null) params.set("episode_number", String(episode));

  const res = await fetch(
    "https://api.opensubtitles.com/api/v1/subtitles?" + params.toString(),
    {
      headers: {
        "Api-Key": OS_KEY,
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error("OpenSubtitles " + res.status + ": " + text);
  }
  return res.json();
}

async function handleSubtitles(url, res) {
  const tmdb = url.searchParams.get("tmdb");
  const type = url.searchParams.get("type") || "movie";
  const season = url.searchParams.get("season");
  const episode = url.searchParams.get("episode");

  if (!tmdb) {
    sendJson(res, 400, { error: "Missing tmdb query param" });
    return;
  }

  if (!TMDB_KEY || !OS_KEY) {
    sendJson(res, 503, {
      error: "Subtitle API keys not configured. Copy .env.example to .env and add TMDB_API_KEY + OPENSUBTITLES_API_KEY.",
      keysRequired: true,
      tmdb: Boolean(TMDB_KEY),
      opensubtitles: Boolean(OS_KEY),
    });
    return;
  }

  try {
    const imdbNumeric = await tmdbToImdb(tmdb, type);
    const osData = await searchOpenSubtitles(
      imdbNumeric,
      season,
      episode
    );

    const tracks = (osData.data || [])
      .filter((item) => item.attributes && item.attributes.files && item.attributes.files.length)
      .slice(0, 12)
      .map((item) => {
        const attrs = item.attributes;
        const file = attrs.files[0];
        return {
          id: file.file_id,
          label: attrs.language || "Unknown",
          language: attrs.language,
          download_count: attrs.download_count,
          file_id: file.file_id,
          file_name: file.file_name,
        };
      });

    sendJson(res, 200, { imdb_id: "tt" + imdbNumeric, tracks });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handleSubtitleFile(url, res) {
  const fileId = url.searchParams.get("file_id");
  if (!fileId) {
    sendJson(res, 400, { error: "Missing file_id" });
    return;
  }
  if (!OS_KEY) {
    sendJson(res, 503, {
      error: "OPENSUBTITLES_API_KEY not set in .env",
      keysRequired: true,
    });
    return;
  }

  try {
    const dlRes = await fetch(
      "https://api.opensubtitles.com/api/v1/download",
      {
        method: "POST",
        headers: {
          "Api-Key": OS_KEY,
          "User-Agent": USER_AGENT,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ file_id: Number(fileId) }),
      }
    );
    if (!dlRes.ok) {
      throw new Error("Download request failed: " + dlRes.status);
    }
    const dl = await dlRes.json();
    const subUrl = dl.link;
    if (!subUrl) throw new Error("No download link in response");

    const subRes = await fetch(subUrl);
    if (!subRes.ok) throw new Error("Subtitle fetch failed: " + subRes.status);
    let text = await subRes.text();

    if (text.includes("WEBVTT") || subUrl.toLowerCase().endsWith(".vtt")) {
      cors(res);
      res.writeHead(200, { "Content-Type": "text/vtt" });
      res.end(text);
      return;
    }

    text = srtToVtt(text);
    cors(res);
    res.writeHead(200, { "Content-Type": "text/vtt" });
    res.end(text);
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

function srtToVtt(srt) {
  const lines = srt.replace(/\r/g, "").split("\n");
  let out = "WEBVTT\n\n";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\d+$/.test(line.trim())) continue;
    if (line.includes("-->")) {
      out += line.replace(/,/g, ".") + "\n";
    } else if (line.trim()) {
      out += line + "\n";
    } else {
      out += "\n";
    }
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost:" + PORT);

  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      tmdb: Boolean(TMDB_KEY),
      opensubtitles: Boolean(OS_KEY),
    });
    return;
  }

  if (url.pathname === "/api/subtitles" && req.method === "GET") {
    await handleSubtitles(url, res);
    return;
  }

  if (url.pathname === "/api/subtitle-file" && req.method === "GET") {
    await handleSubtitleFile(url, res);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log("Subtitle proxy http://localhost:" + PORT);
  console.log("  TMDB key:", TMDB_KEY ? "set" : "MISSING");
  console.log("  OpenSubtitles key:", OS_KEY ? "set" : "MISSING");
});
