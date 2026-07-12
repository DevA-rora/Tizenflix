import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export interface AppConfig {
  port: number;
  publicBase: string;
  tmdbApiKey: string | null;
  dataDir: string;
  downloadsDir: string;
  progressFile: string;
  providerHealthFile: string;
}

export function loadConfig(): AppConfig {
  const dataDir = resolve(process.env.DATA_DIR ?? "./data");
  mkdirSync(dataDir, { recursive: true });
  const downloadsDir = resolve(dataDir, "downloads");
  mkdirSync(downloadsDir, { recursive: true });

  const port = Number(process.env.PORT ?? 8790);
  const publicBase =
    process.env.PUBLIC_BASE ?? `http://localhost:${port}`;

  return {
    port,
    publicBase,
    tmdbApiKey: process.env.TMDB_API_KEY ?? null,
    dataDir,
    downloadsDir,
    progressFile: resolve(dataDir, "progress.json"),
    providerHealthFile: resolve(dataDir, "provider-health.json"),
  };
}

export function requireTmdbKey(config: AppConfig): string {
  if (!config.tmdbApiKey) {
    throw new Error(
      "TMDB_API_KEY is required. Copy .env.example to .env and add your key."
    );
  }
  return config.tmdbApiKey;
}
