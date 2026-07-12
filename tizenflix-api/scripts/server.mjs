#!/usr/bin/env node
/**
 * Tizenflix API — Netflix-style backend for Tizen/Android TV clients
 */

import express from "express";
import { loadConfig } from "../src/config.ts";
import { registerRoutes } from "../src/server/register-routes.ts";
import { ProgressService } from "../src/store/progress.ts";
import { ProviderHealthService } from "../src/store/provider-health.ts";
import { DownloadService } from "../src/download/jobs.ts";
import {
  checkPlaywrightReady,
  formatPlaywrightSetupHelp,
} from "../src/streamflix/network/playwright-health.ts";

const config = loadConfig();

const pwHealth = await checkPlaywrightReady();
if (!pwHealth.ready) {
  if (process.env.STREAMFLIX_REQUIRE_PLAYWRIGHT === "1") {
    console.error(formatPlaywrightSetupHelp());
    process.exit(1);
  }
  console.warn(`Streamflix CF bypass: ${pwHealth.message}`);
  console.warn(formatPlaywrightSetupHelp());
} else {
  console.log(`Streamflix CF bypass: ${pwHealth.message}`);
}
const app = express();

registerRoutes(app, {
  config,
  progress: new ProgressService(config),
  downloads: new DownloadService(config),
  providerHealth: new ProviderHealthService(config),
});

app.listen(config.port, () => {
  console.log(`Tizenflix API ${config.publicBase}`);
  console.log(`  GET  /browse/rows`);
  console.log(`  GET  /play/movie/27205`);
  console.log(`  POST /download/movie/27205`);
  if (!config.tmdbApiKey) {
    console.warn("  TMDB_API_KEY not set — edit tizenflix-api/.env (v3 API key from themoviedb.org/settings/api)");
  }
});
