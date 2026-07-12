import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface AppConfig {
  port: number;
  publicBase: string;
  tmdbApiKey: string | null;
  dataDir: string;
  downloadsDir: string;
  progressFile: string;
  providerHealthFile: string;
}

function loadEnvFile(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function normalizeTmdbKey(raw: string | undefined): string | null {
  const key = raw?.trim();
  if (!key || key === "your_tmdb_api_key_here") return null;
  return key;
}

export function loadConfig(): AppConfig {
  loadEnvFile();
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
    tmdbApiKey: normalizeTmdbKey(process.env.TMDB_API_KEY),
    dataDir,
    downloadsDir,
    progressFile: resolve(dataDir, "progress.json"),
    providerHealthFile: resolve(dataDir, "provider-health.json"),
  };
}

export function requireTmdbKey(config: AppConfig): string {
  if (!config.tmdbApiKey) {
    throw new Error(
      "TMDB_API_KEY is missing or still the placeholder. Edit tizenflix-api/.env with your v3 API key from themoviedb.org/settings/api"
    );
  }
  return config.tmdbApiKey;
}
