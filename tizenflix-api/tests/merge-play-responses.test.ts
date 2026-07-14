import { describe, expect, it } from "vitest";
import { mergePlayResponses } from "../src/normalize/merge-play-responses.js";
import type { PlayResponse } from "../src/types.js";

function stubPlay(sources: PlayResponse["sources"]): PlayResponse {
  return {
    type: "tv",
    tmdbId: "65942",
    sources,
    recommended: sources[0]?.id ?? null,
    subtitles: [],
    nextEpisode: null,
  };
}

describe("mergePlayResponses", () => {
  it("dedupes sources by CDN host", () => {
    const a = stubPlay([
      {
        id: "a",
        provider: "VixSrc",
        label: "720p",
        type: "m3u8",
        url: "https://cdn1.example/a.m3u8",
        priority: 0,
      },
    ]);
    const b = stubPlay([
      {
        id: "b",
        provider: "HiAnime",
        label: "Server 1",
        type: "m3u8",
        url: "https://cdn2.example/b.m3u8",
        priority: 0,
      },
      {
        id: "c",
        provider: "VixSrc",
        label: "1080p",
        type: "m3u8",
        url: "https://cdn1.example/c.m3u8",
        priority: 1,
      },
    ]);
    const merged = mergePlayResponses(a, b);
    expect(merged.sources).toHaveLength(2);
    expect(merged.sources.map((s) => s.provider)).toEqual(["VixSrc", "HiAnime"]);
  });
});
