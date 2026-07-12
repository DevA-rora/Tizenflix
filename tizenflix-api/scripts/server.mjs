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

const config = loadConfig();
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
    console.warn("  TMDB_API_KEY not set — catalog/search routes return 503");
  }
});
