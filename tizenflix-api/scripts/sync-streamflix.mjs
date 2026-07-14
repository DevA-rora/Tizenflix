#!/usr/bin/env node
/**
 * Pull upstream Streamflix Reborn and diff provider/extractor ports.
 *
 * Usage:
 *   STREAMFLIX_REF=/tmp/streamflix-ref npm run sync-streamflix
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = process.env.STREAMFLIX_REF || "/tmp/streamflix-ref";
const UPSTREAM = "https://github.com/streamflix-reborn/streamflix.git";

if (!existsSync(join(REF, ".git"))) {
  console.log("Cloning streamflix-reborn into", REF);
  execSync(`git clone --depth 1 ${UPSTREAM} ${REF}`, { stdio: "inherit" });
} else {
  console.log("Pulling latest streamflix-reborn in", REF);
  execSync("git pull --ff-only", { cwd: REF, stdio: "inherit" });
}

console.log("\nRunning port-from-kotlin (dry generate + diff)…");
execSync("node scripts/port-from-kotlin.mjs --registry", {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, STREAMFLIX_REF: REF },
});

console.log("\nNext steps:");
console.log("  1. Compare Kotlin provider changes in", REF);
console.log("  2. Port fixes to matching files under src/streamflix/providers/ and extractors/");
console.log("  3. Run: npm run benchmark-streamflix");
