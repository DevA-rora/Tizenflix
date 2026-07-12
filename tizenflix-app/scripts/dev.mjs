#!/usr/bin/env node
/**
 * Static dev server for tizenflix-app.
 * Binds 0.0.0.0 so your TV can reach it on the LAN.
 *
 * Usage: npm start
 * TV URL: http://<your-pc-lan-ip>:3010/app/index.html
 */

import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 3010);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".vtt": "text/vtt",
};

function lanAddresses() {
  const out = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family === "IPv4" && !net.internal) out.push(net.address);
    }
  }
  return out;
}

function warnTizenBrewUrlMismatch(ips) {
  const modPkgPath = path.join(ROOT, "..", "package.json");
  try {
    const raw = fs.readFileSync(modPkgPath, "utf8");
    const mod = JSON.parse(raw);
    const url = mod.websiteURL || "";
    const match = url.match(/^http:\/\/([^:]+):(\d+)/);
    if (!match) return;
    const configuredIp = match[1];
    const configuredPort = match[2];
    if (configuredPort !== String(PORT)) {
      console.log("  ⚠ websiteURL port is " + configuredPort + " but server is on " + PORT);
    }
    if (configuredIp !== "localhost" && !ips.includes(configuredIp)) {
      console.log("");
      console.log("  ⚠ TizenBrew websiteURL IP mismatch!");
      console.log("    package.json has: " + configuredIp);
      console.log("    Your LAN IP is:   " + (ips[0] || "(unknown)"));
      console.log("    Update root package.json websiteURL, push, and refresh the GitHub module on TV.");
      console.log("");
    }
  } catch {
    /* optional check */
  }
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded === "/" ? "/app/index.html" : decoded;
  const resolved = path.normalize(path.join(ROOT, rel));
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
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
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const ips = lanAddresses();
  console.log("");
  console.log("Tizenflix app dev server");
  console.log("  App:   http://localhost:" + PORT + "/app/index.html");
  console.log("  Gate:  http://localhost:" + PORT + "/app/gate/index.html");
  for (const ip of ips) {
    console.log("  App:   http://" + ip + ":" + PORT + "/app/index.html");
    console.log("  Gate:  http://" + ip + ":" + PORT + "/app/gate/index.html");
  }
  warnTizenBrewUrlMismatch(ips);
  console.log("");
  console.log("Also run tizenflix-api with PUBLIC_BASE=http://" + (ips[0] || "YOUR_LAN_IP") + ":8790");
  console.log("See docs/tv-setup.md for loading this on your TV via TizenBrew.");
  console.log("");
});
