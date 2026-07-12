#!/usr/bin/env node
/**
 * CLI — resolve Vidking stream URLs
 *
 * Usage:
 *   npm run resolve -- movie 27205
 *   npm run resolve -- movie 27205 --server Oxygen
 *   npm run resolve -- tv 1396 1 1 --all-servers
 *   npm run resolve -- movie 27205 --json
 */

import { resolvePlayableSources, SERVER_PRIORITY } from "../src/index.ts";

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    server: null,
    allServers: false,
    json: false,
    help: false,
  };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--server" || a === "-s") {
      flags.server = args[++i] ?? null;
    } else if (a === "--all-servers") {
      flags.allServers = true;
    } else if (a === "--json" || a === "-j") {
      flags.json = true;
    } else if (a === "--help" || a === "-h") {
      flags.help = true;
    } else if (!a.startsWith("-")) {
      positional.push(a);
    }
  }

  return { flags, positional };
}

function printHelp() {
  console.log(`Usage:
  npm run resolve -- movie <tmdbId> [options]
  npm run resolve -- tv <tmdbId> <season> <episode> [options]

Options:
  --server, -s <name>   Single server (Hydrogen, Titanium, Oxygen, Lithium, Helium)
  --all-servers         Query all servers and merge results
  --json, -j            JSON output
  --help, -h            Show help

Servers (priority): ${SERVER_PRIORITY.join(" → ")}
`);
}

async function main() {
  const { flags, positional } = parseArgs(process.argv);

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  const [mediaType, tmdbId, season, episode] = positional;

  if (!mediaType || !tmdbId) {
    printHelp();
    process.exit(1);
  }

  if (mediaType !== "movie" && mediaType !== "tv") {
    console.error("Type must be 'movie' or 'tv'");
    process.exit(1);
  }

  if (mediaType === "tv" && (!season || !episode)) {
    console.error("TV requires season and episode");
    process.exit(1);
  }

  console.error(
    `Resolving ${mediaType} ${tmdbId}` +
      (mediaType === "tv" ? ` S${season}E${episode}` : "") +
      (flags.server ? ` [${flags.server}]` : flags.allServers ? " [all servers]" : "")
  );

  const result = await resolvePlayableSources({
    type: mediaType,
    tmdbId,
    season,
    episode,
    server: flags.server ?? undefined,
    allServers: flags.allServers,
    firstSuccessOnly: !flags.allServers && !flags.server,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\nTitle: ${result.title ?? "?"}`);
  console.log(`Recommended: ${result.recommended ?? "none"}`);
  console.log(`Sources (${result.sources.length}):\n`);

  for (const s of result.sources) {
    console.log(`[${s.priority}] ${s.provider} — ${s.label} (${s.type})`);
    console.log(`    id:  ${s.id}`);
    console.log(`    url: ${s.url}`);
    console.log("");
  }

  if (result.subtitles.length) {
    console.log(`Subtitles (${result.subtitles.length}):`);
    for (const sub of result.subtitles) {
      console.log(`  ${sub.label} (${sub.language}): ${sub.url}`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
