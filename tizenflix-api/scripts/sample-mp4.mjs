#!/usr/bin/env node
/**
 * Generate a short LAN-test MP4 for TV playback diagnostics.
 * Output: fixtures/sample.mp4 (~10s, 1280x720, H.264+AAC)
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "fixtures", "sample.mp4");
const HLS = join(__dirname, "..", "fixtures", "sample.m3u8");

if (existsSync(OUT) && existsSync(HLS)) {
  console.log("Already exists:", OUT, HLS);
  process.exit(0);
}

const ffmpeg = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=10:size=1280x720:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=10",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    OUT,
  ],
  { stdio: "inherit" }
);

if (ffmpeg.status !== 0) {
  console.error("ffmpeg failed — install ffmpeg to generate fixtures/sample.mp4");
  process.exit(1);
}

console.log("Wrote", OUT);

const hls = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    OUT,
    "-codec",
    "copy",
    "-start_number",
    "0",
    "-hls_time",
    "5",
    "-hls_list_size",
    "0",
    "-hls_segment_filename",
    join(dirname(OUT), "sample%03d.ts"),
    HLS,
  ],
  { stdio: "inherit" }
);

if (hls.status !== 0) {
  console.error("ffmpeg HLS step failed");
  process.exit(1);
}

console.log("Wrote", HLS);
