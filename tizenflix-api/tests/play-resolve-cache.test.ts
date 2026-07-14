import { describe, expect, it } from "vitest";
import {
  getCachedPlay,
  invalidatePlayCacheKey,
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

  it("builds distinct keys for streamflix provider id", () => {
    const all = playResolveCacheKey({
      type: "movie",
      tmdbId: "27205",
      backend: "streamflix",
    });
    const sflix = playResolveCacheKey({
      type: "movie",
      tmdbId: "27205",
      backend: "streamflix",
      providerId: "sflix",
    });
    expect(all).not.toBe(sflix);
  });

  it("builds distinct keys for preferred provider hint", () => {
    const bare = playResolveCacheKey({
      type: "movie",
      tmdbId: "27205",
      backend: "auto",
    });
    const preferred = playResolveCacheKey({
      type: "movie",
      tmdbId: "27205",
      backend: "auto",
      preferredProviderId: "sflix",
    });
    expect(bare).not.toBe(preferred);
  });

  it("invalidates a single cache key", () => {
    const key = playResolveCacheKey({
      type: "tv",
      tmdbId: "65942",
      season: "1",
      episode: "1",
      backend: "auto",
    });
    setCachedPlay(key, samplePlay());
    invalidatePlayCacheKey(key);
    expect(getCachedPlay(key)).toBeNull();
  });
});
