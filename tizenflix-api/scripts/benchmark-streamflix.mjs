#!/usr/bin/env node
/**
 * Benchmark v3 — Vidking vs Streamflix with per-provider matrix + Playwright preflight.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, requireTmdbKey } from "../src/config.js";
import { resolvePlayableSources } from "../src/normalize/to-play-response.js";
import { resolveStreamflixPlay } from "../src/streamflix/resolve.js";
import { fetchMetadata } from "../src/api/metadata.js";
import {
  checkPlaywrightReady,
  formatPlaywrightSetupHelp,
} from "../src/streamflix/network/playwright-health.js";
import { getEnabledProviders } from "../src/streamflix/providers/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
requireTmdbKey(config);

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

function mapProviders(raw) {
  return (raw ?? []).map((p) => ({
    provider: p.provider,
    providerId: p.providerId,
    ok: p.ok,
    ms: p.ms,
    servers: p.servers,
    hls: p.hls,
    subtitles: p.subtitles,
    error: p.error ?? null,
    layer: p.layer ?? null,
    cfBypassUsed: p.cfBypassUsed ?? false,
  }));
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
      sources: play.sources.length,
      hls: play.sources.filter((s) => s.type === "m3u8").length,
      subtitles: play.subtitles.length,
      error: null,
    };
  } catch (err) {
    return {
      ms: Date.now() - t0,
      sources: 0,
      hls: 0,
      subtitles: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function benchStreamflix(title) {
  if (!LIVE) {
    return { ms: 0, sources: 0, hls: 0, subtitles: 0, error: "skipped", providers: [], winningProvider: null };
  }

  const t0 = Date.now();
  try {
    const meta = await fetchMetadata(title.type, title.tmdbId);
    const play = await resolveStreamflixPlay({
      type: title.type,
      tmdbId: title.tmdbId,
      season: title.season,
      episode: title.episode,
      title: meta.title,
      providerTimeoutMs: 20_000,
    });
    const providers = mapProviders(play.providerResults);
    const winner = providers.filter((p) => p.ok).sort((a, b) => b.hls - a.hls || a.ms - b.ms)[0];
    return {
      ms: Date.now() - t0,
      sources: play.sources.length,
      hls: play.sources.filter((s) => s.type === "m3u8").length,
      subtitles: play.subtitles.length,
      error: null,
      providers,
      winningProvider: winner?.provider ?? null,
    };
  } catch (err) {
    const providerResults = err?.providerResults;
    return {
      ms: Date.now() - t0,
      sources: 0,
      hls: 0,
      subtitles: 0,
      error: err instanceof Error ? err.message : String(err),
      providers: mapProviders(providerResults),
      winningProvider: null,
    };
  }
}

function pickWinner(vidking, streamflix) {
  const vScore = (vidking.hls > 0 ? 10 : 0) + (vidking.ms < 20_000 ? 5 : 0);
  const sScore = (streamflix.hls > 0 ? 10 : 0) + (streamflix.ms < 20_000 ? 5 : 0) + (streamflix.subtitles > 0 ? 2 : 0);
  if (vScore > sScore) return "vidking";
  if (sScore > vScore) return "streamflix";
  if (vidking.hls > 0 || streamflix.hls > 0) return "tie";
  return "none";
}

function buildMarkdown(payload) {
  const lines = [
    "# Streamflix Benchmark v3",
    "",
    `Generated: ${payload.generatedAt}`,
    `Playwright: ${payload.playwright.ready ? "ready" : payload.playwright.message}`,
    `Enabled providers: ${payload.enabledProviders}`,
    "",
    "## Summary",
    "",
    `- Vidking wins: ${payload.summary.vidkingWins}`,
    `- Streamflix wins: ${payload.summary.streamflixWins}`,
    `- Ties: ${payload.summary.ties}`,
    `- Unresolved: ${payload.summary.unresolved}`,
    "",
    "## Per title",
    "",
    "| Title | Vidking HLS | Streamflix HLS | Winner | Top provider |",
    "|-------|-------------|----------------|--------|--------------|",
  ];

  for (const r of payload.results) {
    lines.push(
      `| ${r.title} | ${r.vidking.hls} | ${r.streamflix.hls} | ${r.winner} | ${r.streamflix.winningProvider ?? "-"} |`
    );
  }

  lines.push("", "## Provider matrix (Inception)", "");
  const inc = payload.results.find((r) => r.tmdbId === "27205");
  if (inc?.streamflix?.providers?.length) {
    lines.push("| Provider | OK | HLS | ms | Layer | CF | Error |");
    lines.push("|----------|----|-----|-----|-------|-----|-------|");
    for (const p of inc.streamflix.providers) {
      lines.push(
        `| ${p.provider} | ${p.ok} | ${p.hls} | ${p.ms} | ${p.layer ?? "-"} | ${p.cfBypassUsed} | ${(p.error ?? "").slice(0, 60)} |`
      );
    }
  }

  return lines.join("\n");
}

async function main() {
  const pw = await checkPlaywrightReady();
  if (LIVE && !pw.ready) {
    console.error(formatPlaywrightSetupHelp());
    console.error(pw.message);
    process.exit(1);
  }

  const enabled = getEnabledProviders("movie");
  console.log("Tizenflix benchmark v3");
  console.log("Playwright:", pw.ready ? "ready" : pw.message);
  console.log(`Enabled movie providers: ${enabled.length}`);
  console.log("");

  const results = [];
  for (const title of TITLES) {
    process.stdout.write(`Benchmarking ${title.label}... `);
    const vidking = await benchVidking(title);
    const streamflix = await benchStreamflix(title);
    const row = { title: title.label, type: title.type, tmdbId: title.tmdbId, vidking, streamflix, winner: pickWinner(vidking, streamflix) };
    results.push(row);
    console.log(row.winner);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    live: LIVE,
    playwright: pw,
    enabledProviders: enabled.length,
    results,
    summary: {
      vidkingWins: results.filter((r) => r.winner === "vidking").length,
      streamflixWins: results.filter((r) => r.winner === "streamflix").length,
      ties: results.filter((r) => r.winner === "tie").length,
      unresolved: results.filter((r) => r.winner === "none").length,
    },
  };

  const jsonPath = resolve(__dirname, "../STREAMFLIX_BENCHMARK.json");
  const mdPath = resolve(__dirname, "../STREAMFLIX_BENCHMARK.md");
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  writeFileSync(mdPath, buildMarkdown(payload));

  console.log("\nWritten:", jsonPath, mdPath);
  console.table(
    results.map((r) => ({
      title: r.title,
      vidkingHls: r.vidking.hls,
      streamflixHls: r.streamflix.hls,
      winner: r.winner,
      topProvider: r.streamflix.winningProvider ?? "-",
      providers: r.streamflix.providers?.length ?? 0,
    }))
  );
  console.log("\nSummary:", payload.summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
