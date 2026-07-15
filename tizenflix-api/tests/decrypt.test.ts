import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { decryptPayload, MAGIC_HEADER, decryptAndParse } from "../src/crypto/decrypt.js";
import { fetchSeed } from "../src/api/seed.js";
import { fetchServerSources } from "../src/api/sources.js";
import { fetchMetadata } from "../src/api/metadata.js";

const FIXTURE_DIR = join(process.cwd(), "fixtures");

describe("decrypt offline fixture", () => {
  it("decrypts saved ciphertext when fixtures exist", () => {
    const metaPath = join(FIXTURE_DIR, "decrypt-meta-27205.json");
    const cipherPath = join(FIXTURE_DIR, "encrypted-movie-27205.txt");
    if (!existsSync(metaPath) || !existsSync(cipherPath)) {
      return; // skip — run: npm run save-fixtures
    }
    const { tmdbId, seed } = JSON.parse(readFileSync(metaPath, "utf-8"));
    const ciphertext = readFileSync(cipherPath, "utf-8");
    const json = decryptPayload(ciphertext, seed, parseInt(tmdbId, 10));
    const parsed = JSON.parse(json);
    expect(parsed.sources?.length).toBeGreaterThan(0);
  });
});

describe("decrypt", () => {
  it("has expected magic header constant", () => {
    expect(MAGIC_HEADER).toBe("mvm1");
  });

  it("round-trips encrypt logic via live API (integration)", async () => {
    const tmdbId = "27205";
    const meta = await fetchMetadata("movie", tmdbId);
    const seed = await fetchSeed(tmdbId);

    const url = new URL("https://api.wingsdatabase.com/cdn/sources-with-title");
    url.searchParams.set("title", meta.title);
    url.searchParams.set("mediaType", "movie");
    url.searchParams.set("year", String(meta.year));
    url.searchParams.set("episodeId", "1");
    url.searchParams.set("seasonId", "1");
    url.searchParams.set("tmdbId", tmdbId);
    url.searchParams.set("imdbId", meta.imdbId);
    url.searchParams.set("enc", "2");
    url.searchParams.set("seed", seed);
    url.searchParams.set("_t", String(Date.now()));

    const res = await fetch(url, {
      headers: {
        Origin: "https://www.vidking.net",
        Referer: "https://www.vidking.net/",
      },
    });
    expect(res.ok).toBe(true);
    const ciphertext = await res.text();
    expect(ciphertext.length).toBeGreaterThan(10);

    const json = decryptPayload(ciphertext, seed, parseInt(tmdbId, 10));
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty("sources");
    expect(Array.isArray(parsed.sources)).toBe(true);
  }, 60000);
});

describe("fetchServerSources", () => {
  it("returns sources from Hydrogen for Fight Club", async () => {
    const meta = await fetchMetadata("movie", "27205");
    const data = await fetchServerSources("Hydrogen", {
      mediaType: "movie",
      tmdbId: "27205",
      title: meta.title,
      year: meta.year,
      imdbId: meta.imdbId,
      seasonId: "1",
      episodeId: "1",
      timestamp: String(Date.now()),
    });
    expect(data.sources?.length).toBeGreaterThan(0);
    expect(data.sources![0]?.url).toBeTruthy();
  }, 60000);
});
