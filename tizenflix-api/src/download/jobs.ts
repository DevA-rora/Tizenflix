import { createWriteStream, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { UPSTREAM_HEADERS } from "../proxy/upstream.js";
import type { PlayableSource } from "../types.js";
import { downloadHlsParallel } from "./hls-parallel.js";

export type DownloadJobStatus =
  | "queued"
  | "downloading"
  | "muxing"
  | "running"
  | "completed"
  | "failed";

export interface DownloadJob {
  id: string;
  status: DownloadJobStatus;
  type: "movie" | "tv";
  tmdbId: string;
  season: string | null;
  episode: string | null;
  title: string | null;
  sourceId: string | null;
  provider: string | null;
  quality: string | null;
  streamType: string | null;
  outputFile: string | null;
  downloadUrl: string | null;
  segmentsDone: number;
  segmentsTotal: number;
  bytesDownloaded: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

type JobStore = Record<string, DownloadJob>;

function jobsFile(config: AppConfig): string {
  return join(config.dataDir, "download-jobs.json");
}

function loadJobs(config: AppConfig): JobStore {
  const file = jobsFile(config);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as JobStore;
  } catch {
    return {};
  }
}

function saveJobs(config: AppConfig, store: JobStore): void {
  writeFileSync(jobsFile(config), JSON.stringify(store, null, 2));
}

function updateJob(
  config: AppConfig,
  id: string,
  patch: Partial<DownloadJob>
): void {
  const store = loadJobs(config);
  const job = store[id];
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  saveJobs(config, store);
}

async function downloadMp4(url: string, output: string): Promise<void> {
  const res = await fetch(url, {
    headers: UPSTREAM_HEADERS,
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(output));
}

export function pickSource(
  sources: PlayableSource[],
  opts: { quality?: string; sourceId?: string; server?: string }
): PlayableSource {
  if (opts.sourceId) {
    const found = sources.find((s) => s.id === opts.sourceId);
    if (!found) throw new Error(`Source id not found: ${opts.sourceId}`);
    return found;
  }

  let filtered = sources;
  if (opts.server) {
    filtered = filtered.filter(
      (s) => s.provider.toLowerCase() === opts.server!.toLowerCase()
    );
  }
  if (opts.quality) {
    const q = opts.quality.toLowerCase();
    filtered = filtered.filter((s) => s.label.toLowerCase().includes(q));
  }
  if (!filtered.length) {
    throw new Error("No matching source for download");
  }
  return filtered.find((s) => s.type === "mp4") ?? filtered[0]!;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface DownloadJobOptions {
  concurrency?: number;
  maxDurationSeconds?: number;
}

export class DownloadService {
  constructor(private readonly config: AppConfig) {}

  getJob(id: string): DownloadJob | null {
    return loadJobs(this.config)[id] ?? null;
  }

  listJobs(limit = 50): DownloadJob[] {
    return Object.values(loadJobs(this.config))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  createJob(
    params: {
      type: "movie" | "tv";
      tmdbId: string;
      season?: string;
      episode?: string;
      title?: string;
      source: PlayableSource;
      streamUrl: string;
    },
    options: DownloadJobOptions = {}
  ): DownloadJob {
    const id = randomUUID();
    const ext = "mp4";
    const nameParts = [
      params.type,
      params.tmdbId,
      params.season,
      params.episode,
      slug(params.title ?? params.tmdbId),
    ].filter(Boolean);
    const filename = `${nameParts.join("-")}.${ext}`;
    const outputPath = join(this.config.downloadsDir, filename);

    const job: DownloadJob = {
      id,
      status: "queued",
      type: params.type,
      tmdbId: params.tmdbId,
      season: params.season ?? null,
      episode: params.episode ?? null,
      title: params.title ?? null,
      sourceId: params.source.id,
      provider: params.source.provider,
      quality: params.source.label,
      streamType: params.source.type,
      outputFile: filename,
      downloadUrl: null,
      segmentsDone: 0,
      segmentsTotal: 0,
      bytesDownloaded: 0,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const store = loadJobs(this.config);
    store[id] = job;
    saveJobs(this.config, store);

    void this.runJob(
      id,
      params.streamUrl,
      outputPath,
      params.source.type,
      options
    );

    return job;
  }

  private async runJob(
    id: string,
    url: string,
    outputPath: string,
    type: string,
    options: DownloadJobOptions
  ): Promise<void> {
    updateJob(this.config, id, { status: "running" });

    try {
      if (type === "m3u8") {
        updateJob(this.config, id, { status: "downloading" });
        let lastProgressWrite = 0;

        const result = await downloadHlsParallel(url, outputPath, {
          concurrency: options.concurrency ?? 16,
          maxDurationSeconds: options.maxDurationSeconds,
          tmpDir: join(this.config.downloadsDir, `.tmp-${id}`),
          onProgress: (done, total) => {
            if (done - lastProgressWrite >= 10 || done === total) {
              lastProgressWrite = done;
              updateJob(this.config, id, {
                status: done === total ? "muxing" : "downloading",
                segmentsDone: done,
                segmentsTotal: total,
              });
            }
          },
        });

        updateJob(this.config, id, {
          segmentsDone: result.segments,
          segmentsTotal: result.segments,
          bytesDownloaded: result.bytes,
        });
      } else {
        await downloadMp4(url, outputPath);
      }

      updateJob(this.config, id, {
        status: "completed",
        downloadUrl: `${this.config.publicBase}/downloads/${loadJobs(this.config)[id]?.outputFile}`,
        error: null,
      });
    } catch (err) {
      updateJob(this.config, id, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
