#!/usr/bin/env node
/**
 * Download stream via parallel HLS fetch + ffmpeg mux (or direct MP4)
 *
 * Usage:
 *   npm run download -- movie 27205 -o fight-club.mp4
 *   npm run download -- movie 27205 --server Hydrogen --quality 1080p -o out.mp4
 */

import { createWriteStream, writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pipeline } from "node:stream/promises";
import { resolvePlayableSources } from "../dist/index.js";
import { downloadHlsParallel } from "../dist/download/hls-parallel.js";
import { UPSTREAM_HEADERS } from "../dist/proxy/upstream.js";

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    server: null,
    quality: null,
    output: null,
    sourceId: null,
    verifyOnly: false,
    concurrency: 16,
    proofSeconds: null,
  };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--server" || a === "-s") flags.server = args[++i];
    else if (a === "--quality" || a === "-q") flags.quality = args[++i];
    else if (a === "--output" || a === "-o") flags.output = args[++i];
    else if (a === "--source-id") flags.sourceId = args[++i];
    else if (a === "--verify-only") flags.verifyOnly = true;
    else if (a === "--concurrency" || a === "-j") flags.concurrency = Number(args[++i]);
    else if (a === "--proof-seconds") flags.proofSeconds = Number(args[++i]);
    else if (!a.startsWith("-")) positional.push(a);
  }

  return { flags, positional };
}

function pickSource(sources, { quality, sourceId, server }) {
  if (sourceId) {
    const found = sources.find((s) => s.id === sourceId);
    if (!found) throw new Error(`Source id not found: ${sourceId}`);
    return found;
  }

  let filtered = sources;
  if (server) {
    filtered = filtered.filter(
      (s) => s.provider.toLowerCase() === server.toLowerCase()
    );
  }
  if (quality) {
    const q = quality.toLowerCase();
    filtered = filtered.filter((s) =>
      s.label.toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    throw new Error(
      "No matching source. Run resolve first to list available sources."
    );
  }

  return filtered.find((s) => s.type === "mp4") ?? filtered[0];
}

const STREAM_HEADERS = {
  Referer: "https://www.vidking.net/",
  Origin: "https://www.vidking.net",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

async function verifyStream(url, output) {
  const res = await fetch(url, { headers: STREAM_HEADERS, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Stream verify failed: ${res.status}`);
  }
  const text = await res.text();
  writeFileSync(output, text);
  const lines = text.split("\n").filter(Boolean);
  const segmentCount = lines.filter((l) => !l.startsWith("#")).length;
  console.log(`Verified stream manifest (${lines.length} lines, ${segmentCount} segments)`);
  return output;
}

async function downloadMp4(url, output) {
  const res = await fetch(url, {
    headers: {
      Referer: "https://www.vidking.net/",
      Origin: "https://www.vidking.net",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(output));
}

async function main() {
  const { flags, positional } = parseArgs(process.argv);
  const [mediaType, tmdbId, season, episode] = positional;

  if (!mediaType || !tmdbId) {
    console.error(
      "Usage: npm run download -- movie <tmdbId> [-o file] [--server X] [--quality 1080p]"
    );
    process.exit(1);
  }

  const play = await resolvePlayableSources({
    type: mediaType,
    tmdbId,
    season,
    episode,
    server: flags.server ?? undefined,
    allServers: !!flags.server,
    firstSuccessOnly: !flags.server,
  });

  const source = pickSource(play.sources, flags);
  const ext = source.type === "m3u8" ? (flags.verifyOnly ? "m3u8" : "mp4") : "mp4";
  const output =
    flags.output ??
    resolvePath(`${slug(play.title ?? tmdbId)}.${ext}`);

  console.log(`Downloading: ${source.provider} ${source.label} (${source.type})`);
  console.log(`URL: ${source.url}`);
  console.log(`Output: ${output}`);

  if (source.type === "m3u8") {
    if (flags.verifyOnly) {
      await verifyStream(source.url, output);
    } else {
      const tmpDir = resolvePath(`.tmp-download-${Date.now()}`);
      const started = Date.now();
      const result = await downloadHlsParallel(source.url, output, {
        concurrency: flags.concurrency,
        maxDurationSeconds: flags.proofSeconds ?? undefined,
        tmpDir,
        headers: UPSTREAM_HEADERS,
        onProgress: (done, total) => {
          if (done % 25 === 0 || done === total) {
            console.log(`  segments ${done}/${total}`);
          }
        },
      });
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `Done: ${output} (${result.segments} segments, ${(result.bytes / 1024 / 1024).toFixed(1)} MiB, ${elapsed}s)`
      );
      return;
    }
  } else {
    await downloadMp4(source.url, output);
  }

  console.log("Done:", output);
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
