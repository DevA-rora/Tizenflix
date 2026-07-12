#!/usr/bin/env node
/** Save encrypted API payload + metadata for offline decrypt tests */

import { writeFileSync } from "node:fs";
import { fetchMetadata } from "../src/api/metadata.ts";
import { fetchSeed } from "../src/api/seed.ts";
import { VIDKING_HEADERS } from "../src/constants/headers.ts";

const tmdbId = process.argv[2] ?? "27205";

const meta = await fetchMetadata("movie", tmdbId);
const seed = await fetchSeed(tmdbId);
const url = new URL("https://api.wingsdatabase.com/cdn/sources-with-title");
const params = {
  title: meta.title,
  mediaType: "movie",
  year: String(meta.year),
  episodeId: "1",
  seasonId: "1",
  tmdbId,
  imdbId: meta.imdbId,
  enc: "2",
  seed,
  _t: String(Date.now()),
};
for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

const res = await fetch(url, { headers: VIDKING_HEADERS });
const ciphertext = await res.text();
writeFileSync(`fixtures/encrypted-movie-${tmdbId}.txt`, ciphertext);
writeFileSync(
  `fixtures/decrypt-meta-${tmdbId}.json`,
  JSON.stringify({ tmdbId, seed, title: meta.title }, null, 2)
);
console.log(`Saved fixtures for TMDB ${tmdbId} (${ciphertext.length} bytes)`);
