import { describe, expect, it } from "vitest";
import {
  getCachedPlay,
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
});
