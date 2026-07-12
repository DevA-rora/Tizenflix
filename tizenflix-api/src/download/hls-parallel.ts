import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { resolvePlaylistUrl } from "../proxy/proxy-url.js";
import { UPSTREAM_HEADERS } from "../proxy/upstream.js";

export interface HlsSegment {
  url: string;
  duration: number;
}

export interface ParallelHlsOptions {
  concurrency?: number;
  /** Cap download to first N seconds of content (useful for quick proofs) */
  maxDurationSeconds?: number;
  headers?: HeadersInit;
  tmpDir: string;
  onProgress?: (done: number, total: number) => void;
}

export function parseMediaPlaylist(
  manifestUrl: string,
  text: string
): HlsSegment[] {
  const lines = text.split("\n").map((l) => l.trim());
  const segments: HlsSegment[] = [];
  let pendingDuration = 8;

  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const dur = parseFloat(line.slice(8).split(",")[0] ?? "8");
      pendingDuration = Number.isFinite(dur) ? dur : 8;
      continue;
    }
    if (!line || line.startsWith("#")) continue;
    segments.push({
      url: resolvePlaylistUrl(manifestUrl, line),
      duration: pendingDuration,
    });
  }
  return segments;
}

async function fetchText(
  url: string,
  headers: HeadersInit
): Promise<string> {
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Manifest fetch failed: ${res.status} ${url}`);
  }
  return res.text();
}

/** Follow master playlist to a media playlist if needed */
export async function resolveMediaPlaylistUrl(
  url: string,
  headers: HeadersInit = UPSTREAM_HEADERS
): Promise<{ manifestUrl: string; text: string }> {
  const text = await fetchText(url, headers);
  if (!text.includes("#EXT-X-STREAM-INF")) {
    return { manifestUrl: url, text };
  }

  const lines = text.split("\n").map((l) => l.trim());
  let bestUrl: string | null = null;
  let bestBandwidth = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
    const bandwidth = bwMatch ? Number(bwMatch[1]) : 0;
    const next = lines[i + 1];
    if (!next || next.startsWith("#")) continue;
    if (bandwidth >= bestBandwidth) {
      bestBandwidth = bandwidth;
      bestUrl = resolvePlaylistUrl(url, next);
    }
  }

  if (!bestUrl) {
    throw new Error("Master playlist had no variant streams");
  }

  const variantText = await fetchText(bestUrl, headers);
  return { manifestUrl: bestUrl, text: variantText };
}

function limitByDuration(
  segments: HlsSegment[],
  maxDurationSeconds?: number
): HlsSegment[] {
  if (!maxDurationSeconds || maxDurationSeconds <= 0) return segments;
  let total = 0;
  const out: HlsSegment[] = [];
  for (const seg of segments) {
    out.push(seg);
    total += seg.duration;
    if (total >= maxDurationSeconds) break;
  }
  return out;
}

async function downloadSegment(
  url: string,
  dest: string,
  headers: HeadersInit
): Promise<void> {
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Segment fetch failed: ${res.status} ${url}`);
  }
  await pipeline(res.body, createWriteStream(dest));
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      await worker(items[idx]!, idx);
    }
  });
  await Promise.all(runners);
}

function muxSegments(segmentPaths: string[], output: string): Promise<void> {
  const listFile = join(output + ".concat.txt");
  const listBody = segmentPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  writeFileSync(listFile, listBody);

  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      "-bsf:a",
      "aac_adtstoasc",
      output,
    ];
    const proc = spawn("ffmpeg", args, { stdio: "pipe" });
    let stderr = "";
    proc.stderr?.on("data", (c) => {
      stderr += c.toString();
    });
    proc.on("close", (code) => {
      try {
        rmSync(listFile, { force: true });
      } catch {
        /* ignore */
      }
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg mux failed ${code}: ${stderr.slice(-400)}`));
    });
    proc.on("error", reject);
  });
}

/**
 * Download HLS by fetching segments in parallel, then mux with ffmpeg.
 * Much faster than ffmpeg's sequential HLS reader on these CDN streams.
 */
export async function downloadHlsParallel(
  manifestUrl: string,
  outputPath: string,
  options: ParallelHlsOptions
): Promise<{ segments: number; bytes: number }> {
  const headers = options.headers ?? UPSTREAM_HEADERS;
  const concurrency = options.concurrency ?? 16;

  mkdirSync(options.tmpDir, { recursive: true });

  const { manifestUrl: mediaUrl, text } = await resolveMediaPlaylistUrl(
    manifestUrl,
    headers
  );
  const allSegments = limitByDuration(
    parseMediaPlaylist(mediaUrl, text),
    options.maxDurationSeconds
  );
  if (!allSegments.length) {
    throw new Error("No segments found in manifest");
  }

  const segmentPaths: string[] = new Array(allSegments.length);
  let bytes = 0;

  await runPool(allSegments, concurrency, async (seg, index) => {
    const dest = join(
      options.tmpDir,
      `seg-${String(index).padStart(5, "0")}.ts`
    );
    await downloadSegment(seg.url, dest, headers);
    segmentPaths[index] = dest;
    bytes += (await import("node:fs")).statSync(dest).size;
    options.onProgress?.(index + 1, allSegments.length);
  });

  await muxSegments(segmentPaths, outputPath);

  try {
    rmSync(options.tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return { segments: allSegments.length, bytes };
}
