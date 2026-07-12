#!/usr/bin/env node
/**
 * Start the full test harness: static file server + subtitle proxy.
 * Works without API keys — Vidking + demo streams always available.
 *
 * Usage: node scripts/dev.mjs
 * Open:  http://localhost:3000
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TESTS_DIR = path.join(ROOT, "tests");
const PORT = Number(process.env.PORT || 3000);
const SUBTITLE_PORT = Number(process.env.SUBTITLE_PROXY_PORT || 8788);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".vtt": "text/vtt",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded === "/" ? "/index.html" : decoded;
  const resolved = path.normalize(path.join(TESTS_DIR, rel));
  if (!resolved.startsWith(TESTS_DIR)) return null;
  return resolved;
}

const staticServer = http.createServer((req, res) => {
  const filePath = safePath(req.url);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500);
      res.end(err.code === "ENOENT" ? "Not found" : "Error");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const subtitleProc = spawn(
  process.execPath,
  [path.join(__dirname, "subtitle-proxy.mjs")],
  { stdio: "inherit", env: { ...process.env, SUBTITLE_PROXY_PORT: String(SUBTITLE_PORT) } }
);

subtitleProc.on("error", (err) => {
  console.error("Subtitle proxy failed to start:", err.message);
});

function shutdown() {
  subtitleProc.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

staticServer.listen(PORT, () => {
  console.log("");
  console.log("Tizenflix test harness");
  console.log("  App:      http://localhost:" + PORT);
  console.log("  Subtitles http://localhost:" + SUBTITLE_PORT + " (optional — needs API keys)");
  console.log("  Streams   http://localhost:8787 (optional — docker compose up -d)");
  console.log("");
  console.log("No API keys required for Vidking iframe + demo streams.");
  console.log("");
});
