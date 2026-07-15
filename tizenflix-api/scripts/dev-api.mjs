#!/usr/bin/env node
/**
 * Dev launcher for tizenflix-api.
 *
 * Automatically detects your LAN IP and starts the API server with:
 *   PUBLIC_BASE=http://<LAN-IP>:<PORT>
 *
 * You can override via environment:
 *   PORT=9000 node scripts/dev-api.mjs
 *   PUBLIC_BASE=http://my-host:8790 node scripts/dev-api.mjs
 *
 * Works on Linux and macOS (no bash-specific syntax).
 */
import { spawnSync } from "node:child_process";
import os from "node:os";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");

if (!existsSync(tsc)) {
  console.error("typescript not found — run: npm install (in tizenflix-api)");
  process.exit(1);
}

// --- Detect LAN IP (OS-agnostic via Node's os.networkInterfaces) ---
function detectLanIp() {
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of (nets ?? [])) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

const port = process.env.PORT ?? "8790";
const lanIp = detectLanIp();

// Build PUBLIC_BASE: respect existing env var, fall back to detected LAN IP or localhost.
let publicBase = process.env.PUBLIC_BASE;
if (!publicBase) {
  publicBase = lanIp
    ? `http://${lanIp}:${port}`
    : `http://localhost:${port}`;
  console.log(`[dev-api] AUTO-DETECTED PUBLIC_BASE=${publicBase}`);
  if (!lanIp) {
    console.warn("[dev-api] No LAN IP found — using localhost. TV won't be able to reach the API.");
  }
} else {
  console.log(`[dev-api] Using PUBLIC_BASE=${publicBase} (from environment)`);
}

// --- Build TypeScript ---
console.log("[dev-api] Compiling TypeScript...");
const build = spawnSync(process.execPath, [tsc, "-p", root], {
  cwd: root,
  stdio: "inherit",
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// --- Start server ---
const result = spawnSync(process.execPath, [join(root, "scripts/server.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PUBLIC_BASE: publicBase,
    PORT: port,
  },
});
process.exit(result.status ?? 1);
