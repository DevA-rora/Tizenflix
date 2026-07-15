import { describe, expect, it } from "vitest";
import { getTmdbNativeSources, TMDB_NATIVE_SOURCES } from "../src/streamflix/tmdb-native/registry.js";
import { preflightSource } from "../src/streamflix/tmdb-native/preflight.js";
import { resolveTmdbNativeRace } from "../src/streamflix/tmdb-native/resolve.js";

describe("tmdb-native registry", () => {
  it("exports race resolve helper", () => {
    expect(typeof resolveTmdbNativeRace).toBe("function");
  });

  it("lists TMDB-native sources including locale extras", () => {
    expect(TMDB_NATIVE_SOURCES.length).toBeGreaterThanOrEqual(16);
    expect(TMDB_NATIVE_SOURCES.some((s) => s.id === "moflix")).toBe(true);
    expect(TMDB_NATIVE_SOURCES.some((s) => s.id === "afterdark")).toBe(true);
  });

  it("builds VixSrc movie URL from TMDB id", async () => {
    const vix = TMDB_NATIVE_SOURCES.find((s) => s.id === "vixsrc")!;
    const entries = await vix.buildEntries({
      type: "movie",
      tmdbId: "27205",
      title: "Inception",
    });
    expect(entries[0]?.url).toBe("https://vixsrc.to/api/movie/27205");
  });

  it("builds 2Embed TV URL", async () => {
    const two = TMDB_NATIVE_SOURCES.find((s) => s.id === "twoembed")!;
    const entries = await two.buildEntries({
      type: "tv",
      tmdbId: "1396",
      season: "1",
      episode: "1",
      title: "Breaking Bad",
    });
    expect(entries[0]?.url).toContain("embedtv/1396");
  });

  it("Moviesapi is movies-only", () => {
    const movieSources = getTmdbNativeSources("movie");
    const tvSources = getTmdbNativeSources("tv");
    expect(movieSources.find((s) => s.id === "moviesapi")).toBeDefined();
    expect(tvSources.find((s) => s.id === "moviesapi")).toBeUndefined();
  });

  it("Videasy uses WingsDatabase CDN (not marked as vidking duplicate)", () => {
    const v = TMDB_NATIVE_SOURCES.find((s) => s.id === "videasy");
    expect(v?.duplicateOf).toBeUndefined();
    expect(v?.mainUrl).toContain("wingsdatabase");
  });

  it("Vidzee builds 14 server entries", async () => {
    const vz = TMDB_NATIVE_SOURCES.find((s) => s.id === "vidzee")!;
    const entries = await vz.buildEntries({
      type: "movie",
      tmdbId: "27205",
      title: "Inception",
    });
    expect(entries.length).toBe(14);
    expect(entries[0]?.url).toContain("sr=0");
  });
});

describe("tmdb-native preflight", () => {
  it("returns structured result for unknown host", async () => {
    const fake = {
      id: "fake",
      name: "Fake",
      mainUrl: "https://invalid.invalid.example",
      supportsMovies: true,
      supportsTv: true,
      priority: 99,
      buildEntries: () => [],
    };
    const result = await preflightSource(fake, 2000);
    expect(result.sourceId).toBe("fake");
    expect(result.reachable).toBe(false);
    expect(result.error || result.status !== null).toBeTruthy();
  });
});
