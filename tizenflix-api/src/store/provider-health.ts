import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { AppConfig } from "../config.js";

interface ProviderStats {
  successes: number;
  failures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

type HealthStore = Record<string, ProviderStats>;

function loadStore(file: string): HealthStore {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as HealthStore;
  } catch {
    return {};
  }
}

function saveStore(file: string, store: HealthStore): void {
  writeFileSync(file, JSON.stringify(store, null, 2));
}

export class ProviderHealthService {
  constructor(private readonly config: AppConfig) {}

  report(provider: string, success: boolean): void {
    const store = loadStore(this.config.providerHealthFile);
    const stats = store[provider] ?? {
      successes: 0,
      failures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
    };
    if (success) {
      stats.successes++;
      stats.lastSuccessAt = new Date().toISOString();
    } else {
      stats.failures++;
      stats.lastFailureAt = new Date().toISOString();
    }
    store[provider] = stats;
    saveStore(this.config.providerHealthFile, store);
  }

  list(providers: Array<{ id: string; name: string; endpoint: string }>) {
    const store = loadStore(this.config.providerHealthFile);
    return providers.map((p) => {
      const stats = store[p.name];
      const total = (stats?.successes ?? 0) + (stats?.failures ?? 0);
      const score = total ? (stats!.successes / total) : null;
      let status: "up" | "down" | "unknown" = "unknown";
      if (stats) {
        status = score !== null && score >= 0.5 ? "up" : "down";
      }
      return {
        ...p,
        status,
        successes: stats?.successes ?? 0,
        failures: stats?.failures ?? 0,
        lastSuccessAt: stats?.lastSuccessAt ?? null,
        lastFailureAt: stats?.lastFailureAt ?? null,
      };
    });
  }
}
