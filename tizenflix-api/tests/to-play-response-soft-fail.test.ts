import { describe, it, expect, vi } from "vitest";
import { resolvePlayableSources } from "../src/normalize/to-play-response.js";

vi.mock("../src/api/metadata.js", () => ({
  fetchMetadata: vi.fn(async () => ({
    title: "Whiplash",
    year: 2014,
    imdbId: "tt2582802",
  })),
}));

vi.mock("../src/api/sources.js", () => ({
  fetchServerSources: vi.fn(async () => ({ sources: [] })),
  fetchServerSourcesDirect: vi.fn(async () => null),
}));

describe("resolvePlayableSources soft-fail", () => {
  it("returns empty play with warnings when all servers miss (no throw)", async () => {
    const play = await resolvePlayableSources({
      type: "movie",
      tmdbId: "244786",
      allServers: true,
      firstSuccessOnly: false,
    });
    expect(play.sources).toEqual([]);
    expect(play.recommended).toBeNull();
    expect(play.warnings?.length).toBeGreaterThan(0);
    expect(play.warnings![0]).toMatch(/No sources returned/);
  });

  it("throws when a forced server returns no sources", async () => {
    await expect(
      resolvePlayableSources({
        type: "movie",
        tmdbId: "244786",
        server: "Oxygen",
      })
    ).rejects.toThrow(/No sources returned|No playable sources/);
  });
});
