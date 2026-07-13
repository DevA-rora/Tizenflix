import { describe, expect, it } from "vitest";
import {
  getCachedPlay,
  isCachedPlayValidated,
  markCachedPlayValidated,
  playResolveCacheKey,
  setCachedPlay,
} from "../src/cache/play-resolve-cache.js";
import type { PlayResponse } from "../src/types.js";

const samplePlay = (): PlayResponse => ({
  type: "movie",
  tmdbId: "27205",
  sources: [
    {
      id: "vixsrc-0",
      provider: "VixSrc",
      label: "720p",
      type: "m3u8",
      url: "https://cdn.example/vixsrc.m3u8",
      priority: 0,
    },
  ],
  recommended: "vixsrc-0",
  subtitles: [],
  nextEpisode: null,
});

describe("play resolve cache", () => {
  it("stores and retrieves cached play responses", () => {
    const key = playResolveCacheKey({
      type: "movie",
      tmdbId: "27205",
      backend: "auto",
    });
    const play = samplePlay();
    setCachedPlay(key, play);
    expect(getCachedPlay(key)).toEqual(play);
  });

  it("marks cached plays as validated", () => {
    const key = playResolveCacheKey({
      type: "movie",
      tmdbId: "27205",
      backend: "auto",
    });
    const play = samplePlay();
    setCachedPlay(key, play);
    expect(isCachedPlayValidated(key)).toBe(false);
    markCachedPlayValidated(key);
    expect(isCachedPlayValidated(key)).toBe(true);
  });

  it("builds distinct keys per title", () => {
    const movieKey = playResolveCacheKey({ type: "movie", tmdbId: "1", backend: "auto" });
    const tvKey = playResolveCacheKey({
      type: "tv",
      tmdbId: "1",
      season: "1",
      episode: "1",
      backend: "auto",
    });
    expect(movieKey).not.toBe(tvKey);
  });

  it("builds distinct keys for different sources lists", () => {
    const bare = playResolveCacheKey({
      type: "tv",
      tmdbId: "273240",
      season: "1",
      episode: "1",
      backend: "tmdb-native",
    });
    const backups = playResolveCacheKey({
      type: "tv",
      tmdbId: "273240",
      season: "1",
      episode: "1",
      backend: "tmdb-native",
      sources: "twoembed,vidrock,vidsrcnet",
    });
    expect(bare).not.toBe(backups);
  });

  it("builds distinct keys for audio and catalog language", () => {
    const original = playResolveCacheKey({
      type: "movie",
      tmdbId: "27205",
      backend: "auto",
      audioLang: "original",
    });
    const japanese = playResolveCacheKey({
      type: "movie",
      tmdbId: "27205",
      backend: "auto",
      audioLang: "ja",
    });
    expect(original).not.toBe(japanese);
  });
});
