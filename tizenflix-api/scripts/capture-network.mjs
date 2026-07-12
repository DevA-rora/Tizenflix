#!/usr/bin/env node
/**
 * Playwright network capture — logs Vidking embed XHR/fetch traffic.
 * Use to detect API or crypto changes when player bundle updates.
 *
 * Usage: npm run capture
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "fixtures");
const EMBED_URL = "https://www.vidking.net/embed/movie/27205?autoPlay=false";
const PLAYER_BUNDLE_PATTERN = /VideoPlayer-[\w]+\.js/;

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("Install playwright: npm install && npx playwright install chromium");
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const requests = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("request", (req) => {
    const url = req.url();
    if (
      url.includes("wingsdatabase") ||
      url.includes("videasy") ||
      url.includes("m3u8") ||
      url.includes(".mp4") ||
      PLAYER_BUNDLE_PATTERN.test(url)
    ) {
      requests.push({
        method: req.method(),
        url,
        resourceType: req.resourceType(),
      });
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/seed?") || url.includes("sources-with-title")) {
      const entry = requests.find((r) => r.url === url);
      if (entry) {
        entry.status = res.status();
        entry.contentType = res.headers()["content-type"];
        if (url.includes("sources-with-title") && res.ok()) {
          try {
            const text = await res.text();
            entry.payloadLength = text.length;
            entry.payloadPreview = text.slice(0, 120);
          } catch {
            /* body may be consumed */
          }
        }
      }
    }
  });

  console.log("Loading embed:", EMBED_URL);
  await page.goto(EMBED_URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(8000);

  const bundleMatch = requests.find((r) => PLAYER_BUNDLE_PATTERN.test(r.url));
  const out = {
    capturedAt: new Date().toISOString(),
    embedUrl: EMBED_URL,
    playerBundle: bundleMatch?.url ?? null,
    requestCount: requests.length,
    requests,
  };

  const outFile = join(OUT_DIR, `capture-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`Saved ${requests.length} relevant requests to ${outFile}`);

  if (bundleMatch) {
    console.log("Player bundle:", bundleMatch.url);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
