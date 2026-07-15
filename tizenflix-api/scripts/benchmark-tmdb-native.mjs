#!/usr/bin/env node
/**
 * Benchmark v4 — Vidking vs each TMDB-native source (VixSrc, 2Embed, etc.)
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, requireTmdbKey } from "../dist/config.js";
import { resolvePlayableSources } from "../dist/normalize/to-play-response.js";
import { resolveTmdbNativePlay } from "../dist/streamflix/tmdb-native/resolve.js";
import { AUTO_TMDB_SOURCE_IDS } from "../dist/streamflix/tmdb-native/auto-sources.js";
import { resolveWithBackend } from "../dist/normalize/resolve-backend.js";
import { TMDB_NATIVE_SOURCES } from "../dist/streamflix/tmdb-native/registry.js";
import {
  preflightAllSources,
  formatPreflightHelp,
} from "../dist/streamflix/tmdb-native/preflight.js";
import { fetchMetadata } from "../dist/api/metadata.js";
import {
  checkPlaywrightReady,
  formatPlaywrightSetupHelp,
} from "../dist/streamflix/network/playwright-health.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
requireTmdbKey(config);

const SOURCE_TIMEOUT_MS = Number(process.env.BENCHMARK_SOURCE_TIMEOUT_MS ?? 30_000);
const LIVE = process.env.RUN_LIVE_BENCHMARK !== "0";

const TITLES = [
  { label: "Inception", type: "movie", tmdbId: "27205" },
  { label: "Off Campus S1E1", type: "tv", tmdbId: "273240", season: "1", episode: "1" },
  { label: "The Matrix", type: "movie", tmdbId: "603" },
  { label: "Breaking Bad S1E1", type: "tv", tmdbId: "1396", season: "1", episode: "1" },
  { label: "Interstellar", type: "movie", tmdbId: "157336" },
  { label: "The Office S1E1", type: "tv", tmdbId: "2316", season: "1", episode: "1" },
  { label: "Pulp Fiction", type: "movie", tmdbId: "680" },
  { label: "Stranger Things S1E1", type: "tv", tmdbId: "66732", season: "1", episode: "1" },
  { label: "The Dark Knight", type: "movie", tmdbId: "155" },
  { label: "Game of Thrones S1E1", type: "tv", tmdbId: "1399", season: "1", episode: "1" },
];

function mapSources(raw) {
  return (raw ?? []).map((s) => ({
    sourceId: s.sourceId,
    sourceName: s.sourceName,
    ok: s.ok,
    ms: s.ms,
    hls: s.hls,
    subtitles: s.subtitles,
    error: s.error ?? null,
    layer: s.layer ?? null,
    cfBypassUsed: s.cfBypassUsed ?? false,
    duplicateOf: s.duplicateOf ?? null,
  }));
}

async function benchAuto(title) {
  const t0 = Date.now();
  try {
    const play = await resolveWithBackend({
      type: title.type,
      tmdbId: title.tmdbId,
      season: title.season,
      episode: title.episode,
      backend: "auto",
      profile: "tizen",
    });
    const sourceIds = [...new Set(play.sources.map((s) => s.sourceId).filter(Boolean))];
    return {
      ms: Date.now() - t0,
      hls: play.sources.filter((s) => s.type === "m3u8").length,
      sourceIds,
      recommended: play.recommended,
      error: null,
    };
  } catch (err) {
    return {
      ms: Date.now() - t0,
      hls: 0,
      sourceIds: [],
      recommended: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function benchVidking(title) {
  const t0 = Date.now();
  try {
    const play = await resolvePlayableSources({
      type: title.type,
      tmdbId: title.tmdbId,
      season: title.season,
      episode: title.episode,
      allServers: true,
      profile: "tizen",
    });
    return {
      ms: Date.now() - t0,
      hls: play.sources.filter((s) => s.type === "m3u8").length,
      error: null,
    };
  } catch (err) {
    return {
      ms: Date.now() - t0,
      hls: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function benchTmdbNativeAggregate(title, meta) {
  if (!LIVE) return { ms: 0, hls: 0, error: "skipped", sources: [], winningSource: null };
  const t0 = Date.now();
  try {
    const play = await resolveTmdbNativePlay({
      type: title.type,
      tmdbId: title.tmdbId,
      season: title.season,
      episode: title.episode,
      title: meta.title,
      year: meta.year,
      imdbId: meta.imdbId,
      sourceTimeoutMs: SOURCE_TIMEOUT_MS,
    });
    const sources = mapSources(play.sourceResults);
    const winner = sources.filter((s) => s.ok).sort((a, b) => b.hls - a.hls || a.ms - b.ms)[0];
    return {
      ms: Date.now() - t0,
      hls: play.sources.filter((s) => s.type === "m3u8").length,
      error: null,
      sources,
      winningSource: winner?.sourceName ?? null,
    };
  } catch (err) {
    return {
      ms: Date.now() - t0,
      hls: 0,
      error: err instanceof Error ? err.message : String(err),
      sources: mapSources(err?.sourceResults),
      winningSource: null,
    };
  }
}

async function benchSingleSource(title, meta, sourceId) {
  if (!LIVE) return { hls: 0, ms: 0, ok: false, error: "skipped", layer: null };
  const t0 = Date.now();
  try {
    const play = await resolveTmdbNativePlay({
      type: title.type,
      tmdbId: title.tmdbId,
      season: title.season,
      episode: title.episode,
      title: meta.title,
      year: meta.year,
      imdbId: meta.imdbId,
      onlySourceId: sourceId,
      sourceTimeoutMs: SOURCE_TIMEOUT_MS,
    });
    const r = play.sourceResults?.[0];
    return {
      hls: play.sources.filter((s) => s.type === "m3u8").length,
      ms: Date.now() - t0,
      ok: r?.ok ?? false,
      error: r?.error ?? null,
      layer: r?.layer ?? null,
    };
  } catch (err) {
    const r = err?.sourceResults?.[0];
    return {
      hls: 0,
      ms: Date.now() - t0,
      ok: false,
      error: r?.error ?? (err instanceof Error ? err.message : String(err)),
      layer: r?.layer ?? null,
    };
  }
}

function pickWinner(vidking, tmdbNative) {
  const vScore = (vidking.hls > 0 ? 10 : 0) + (vidking.ms < 20_000 ? 5 : 0);
  const sScore = (tmdbNative.hls > 0 ? 10 : 0) + (tmdbNative.ms < 20_000 ? 5 : 0);
  if (vScore > sScore) return "vidking";
  if (sScore > vScore) return "tmdb-native";
  if (vidking.hls > 0 || tmdbNative.hls > 0) return "tie";
  return "none";
}

function buildMarkdown(payload) {
  const lines = [
    "# TMDB-Native Benchmark v4",
    "",
    `Generated: ${payload.generatedAt}`,
    `Sources: ${payload.sourceCount}`,
    "",
    "## Preflight (embed host reachability)",
    "",
    "| Source | Reachable | Status | ms |",
    "|--------|-----------|--------|-----|",
  ];

  for (const p of payload.preflight) {
    lines.push(`| ${p.sourceName} | ${p.reachable} | ${p.status ?? "-"} | ${p.ms} |`);
  }

  lines.push("", "## Summary", "");
  lines.push(`- Vidking wins: ${payload.summary.vidkingWins}`);
  lines.push(`- TMDB-native wins: ${payload.summary.tmdbNativeWins}`);
  lines.push(`- Ties: ${payload.summary.ties}`);
  lines.push(`- Unresolved: ${payload.summary.unresolved}`);
  lines.push("", "## Matrix A — Per title", "");
  lines.push("| Title | Vidking HLS | TMDB-native HLS | Winner | Best source |");
  lines.push("|-------|-------------|-----------------|--------|-------------|");

  for (const r of payload.results) {
    lines.push(
      `| ${r.title} | ${r.vidking.hls} | ${r.tmdbNative.hls} | ${r.winner} | ${r.tmdbNative.winningSource ?? "-"} |`
    );
  }

  lines.push("", "## Matrix B — Source × Title (HLS count)", "");
  const header = ["Source", ...TITLES.map((t) => t.label.slice(0, 12)), "Wins", "Avg ms"];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${header.map(() => "---").join(" | ")} |`);

  for (const src of payload.sourceMatrix) {
    lines.push(
      `| ${src.sourceName} | ${src.cells.join(" | ")} | ${src.wins} | ${src.avgMs} |`
    );
  }

  lines.push("", "## Matrix C — Inception per-source detail", "");
  const inc = payload.results.find((r) => r.tmdbId === "27205");
  if (inc?.tmdbNative?.sources?.length) {
    lines.push("| Source | OK | HLS | ms | Layer | Error |");
    lines.push("|--------|----|-----|-----|-------|-------|");
    for (const s of inc.tmdbNative.sources) {
      lines.push(
        `| ${s.sourceName} | ${s.ok} | ${s.hls} | ${s.ms} | ${s.layer ?? "-"} | ${(s.error ?? "").slice(0, 50)} |`
      );
    }
  }

  return lines.join("\n");
}

async function main() {
  const pw = await checkPlaywrightReady();
  if (LIVE && !pw.ready) {
    console.error(formatPlaywrightSetupHelp());
    process.exit(1);
  }

  const preflight = await preflightAllSources(TMDB_NATIVE_SOURCES);
  const vixsrcDown = preflight.find((p) => p.sourceId === "vixsrc" && !p.reachable);
  if (LIVE && vixsrcDown) {
    console.warn(formatPreflightHelp(preflight));
    console.warn("(Continuing benchmark — some sources may fail at extract layer)\n");
  }

  console.log("TMDB-native benchmark v4");
  console.log(`Sources: ${TMDB_NATIVE_SOURCES.length}`);
  console.log("");

  const sourceMatrix = TMDB_NATIVE_SOURCES.map((s) => ({
    sourceId: s.id,
    sourceName: s.name,
    cells: [],
    wins: 0,
    totalMs: 0,
    runs: 0,
    avgMs: 0,
  }));

  const results = [];

  for (const title of TITLES) {
    process.stdout.write(`Benchmarking ${title.label}... `);
    const meta = await fetchMetadata(title.type, title.tmdbId);
    const vidking = await benchVidking(title);
    const tmdbNative = await benchTmdbNativeAggregate(title, meta);
    const auto = await benchAuto(title);

    const sourceProbes = [];
    for (let i = 0; i < TMDB_NATIVE_SOURCES.length; i++) {
      const src = TMDB_NATIVE_SOURCES[i];
      const row = sourceMatrix[i];
      if (title.type === "movie" && !src.supportsMovies) {
        row.cells.push(0);
        continue;
      }
      if (title.type === "tv" && !src.supportsTv) {
        row.cells.push(0);
        continue;
      }
      sourceProbes.push(
        benchSingleSource(title, meta, src.id).then((one) => {
          row.cells.push(one.hls);
          row.totalMs += one.ms;
          row.runs++;
          if (one.hls > 0 && vidking.hls <= one.hls) row.wins++;
        })
      );
    }
    await Promise.all(sourceProbes);

    const row = {
      title: title.label,
      type: title.type,
      tmdbId: title.tmdbId,
      vidking,
      tmdbNative,
      auto,
      winner: pickWinner(vidking, tmdbNative),
    };
    results.push(row);
    console.log(row.winner);
  }

  for (const row of sourceMatrix) {
    row.avgMs = row.runs ? Math.round(row.totalMs / row.runs) : 0;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    live: LIVE,
    playwright: pw,
    sourceCount: TMDB_NATIVE_SOURCES.length,
    preflight,
    results,
    sourceMatrix,
    autoSourceIds: [...AUTO_TMDB_SOURCE_IDS],
    summary: {
      vidkingWins: results.filter((r) => r.winner === "vidking").length,
      tmdbNativeWins: results.filter((r) => r.winner === "tmdb-native").length,
      ties: results.filter((r) => r.winner === "tie").length,
      unresolved: results.filter((r) => r.winner === "none").length,
    },
  };

  const jsonPath = resolve(__dirname, "../TMDB_NATIVE_BENCHMARK.json");
  const mdPath = resolve(__dirname, "../TMDB_NATIVE_BENCHMARK.md");
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  writeFileSync(mdPath, buildMarkdown(payload));

  console.log("\nWritten:", jsonPath, mdPath);
  console.log("\nSummary:", payload.summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
