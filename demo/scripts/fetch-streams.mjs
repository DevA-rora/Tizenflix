#!/usr/bin/env node
/**
 * CLI helper — list stream URLs from local tmdb-embed-api.
 * Usage:
 *   node scripts/fetch-streams.mjs movie 27205
 *   node scripts/fetch-streams.mjs series 1396 1 1
 */

const BASE = process.env.STREAM_API_URL || "http://localhost:8787";

function detectType(url) {
  if (!url) return "unknown";
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8") || lower.includes("m3u8")) return "m3u8";
  if (lower.includes(".mp4") || lower.includes(".webm")) return "mp4";
  return "unknown";
}

async function main() {
  const [, , mediaType, id, season, episode] = process.argv;

  if (!mediaType || !id) {
    console.error("Usage:");
    console.error("  node scripts/fetch-streams.mjs movie <tmdbId>");
    console.error("  node scripts/fetch-streams.mjs series <tmdbId> <season> <episode>");
    process.exit(1);
  }

  let path = `/api/streams/${mediaType}/${id}`;
  if (mediaType === "series") {
    if (!season || !episode) {
      console.error("Series requires season and episode.");
      process.exit(1);
    }
    path += `?season=${season}&episode=${episode}`;
  }

  const url = BASE + path;
  console.log("Fetching:", url);

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error("Failed to reach stream API at", BASE);
    console.error("Is docker compose up? Run: docker compose up -d");
    console.error(err.message);
    process.exit(1);
  }

  if (!res.ok) {
    console.error("HTTP", res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const streams = Array.isArray(data)
    ? data
    : data.streams || data.results || [];

  if (!streams.length) {
    console.log("No streams returned. Try enabling providers in http://localhost:8787/");
    process.exit(0);
  }

  console.log(`\nFound ${streams.length} stream(s):\n`);
  streams.forEach((s, i) => {
    const type = detectType(s.url);
    console.log(`[${i + 1}] ${s.title || "Untitled"}`);
    console.log(`    provider: ${s.provider || "?"}`);
    console.log(`    quality:  ${s.quality || "?"}`);
    console.log(`    type:     ${type}`);
    console.log(`    url:      ${s.url}`);
    console.log("");
  });
}

main();
