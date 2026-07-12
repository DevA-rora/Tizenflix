import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { AppConfig } from "../config.js";

export interface ProgressEntry {
  tmdbId: string;
  type: "movie" | "tv";
  season: number | null;
  episode: number | null;
  title?: string;
  poster?: string | null;
  positionSeconds: number;
  durationSeconds: number;
  percent: number;
  updatedAt: string;
}

type ProgressStore = Record<string, ProgressEntry>;

function progressKey(entry: Pick<ProgressEntry, "tmdbId" | "type" | "season" | "episode">): string {
  if (entry.type === "tv") {
    return `tv:${entry.tmdbId}:${entry.season}:${entry.episode}`;
  }
  return `movie:${entry.tmdbId}`;
}

function loadStore(file: string): ProgressStore {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as ProgressStore;
  } catch {
    return {};
  }
}

function saveStore(file: string, store: ProgressStore): void {
  writeFileSync(file, JSON.stringify(store, null, 2));
}

export class ProgressService {
  constructor(private readonly config: AppConfig) {}

  save(entry: ProgressEntry): ProgressEntry {
    const store = loadStore(this.config.progressFile);
    const key = progressKey(entry);
    const saved = { ...entry, updatedAt: new Date().toISOString() };
    store[key] = saved;
    saveStore(this.config.progressFile, store);
    return saved;
  }

  get(tmdbId: string, type: "movie" | "tv", season?: number, episode?: number): ProgressEntry | null {
    const store = loadStore(this.config.progressFile);
    const key =
      type === "tv"
        ? progressKey({ tmdbId, type, season: season ?? 1, episode: episode ?? 1 })
        : progressKey({ tmdbId, type, season: null, episode: null });
    return store[key] ?? null;
  }

  continueWatching(limit = 20): ProgressEntry[] {
    const store = loadStore(this.config.progressFile);
    return Object.values(store)
      .filter((e) => e.percent > 2 && e.percent < 95)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }
}
