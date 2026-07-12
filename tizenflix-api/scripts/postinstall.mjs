#!/usr/bin/env node
/** Install Playwright Chromium unless skipped (CI). */
import { spawnSync } from "node:child_process";

if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1") {
  console.log("postinstall: skipping Playwright browser download (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)");
  process.exit(0);
}

const result = spawnSync("npx", ["playwright", "install", "chromium"], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  console.warn(
    "postinstall: playwright install chromium failed — run manually: npm run setup"
  );
  process.exit(0);
}
