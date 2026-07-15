#!/usr/bin/env node
/**
 * Tizenflix API — Netflix-style backend for Tizen/Android TV clients
 */

import express from "express";
import { loadConfig } from "../dist/config.js";
import { registerRoutes } from "../dist/server/register-routes.js";
import { ProgressService } from "../dist/store/progress.js";
import { ProviderHealthService } from "../dist/store/provider-health.js";
import { DownloadService } from "../dist/download/jobs.js";
import {
  checkPlaywrightReady,
  formatPlaywrightSetupHelp,
} from "../dist/streamflix/network/playwright-health.js";

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
