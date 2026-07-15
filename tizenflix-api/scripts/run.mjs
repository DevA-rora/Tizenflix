#!/usr/bin/env node
/**
 * Cross-platform runner: compile TypeScript then execute a script with plain node.
 * Avoids tsx (missing/broken on some Linux Node builds) and native type-stripping
 * (unavailable when Node was built without TypeScript support).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");

if (!existsSync(tsc)) {
  console.error("typescript not found — run: npm install (in tizenflix-api)");
  process.exit(1);
}

const build = spawnSync(process.execPath, [tsc, "-p", root], {
  cwd: root,
  stdio: "inherit",
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error("Usage: node scripts/run.mjs <script.mjs> [args...]");
  process.exit(1);
}

const result = spawnSync(process.execPath, [join(root, script), ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
