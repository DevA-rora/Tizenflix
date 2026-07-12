import { describe, it, expect } from "vitest";
import { resolvePlayableSources } from "../src/normalize/to-play-response.js";
import { SERVER_PRIORITY } from "../src/constants/servers.js";

describe("resolvePlayableSources integration", () => {
  it("resolves movie 27205 (Fight Club)", async () => {
    const play = await resolvePlayableSources({
      type: "movie",
      tmdbId: "27205",
      firstSuccessOnly: true,
    });
    expect(play.sources.length).toBeGreaterThan(0);
    expect(play.tmdbId).toBe("27205");
    expect(play.recommended).toBeTruthy();
    const types = new Set(play.sources.map((s) => s.type));
    expect(types.has("m3u8") || types.has("mp4") || types.has("unknown")).toBe(
      true
    );
  }, 90000);

  it("resolves TV 1396 S1E1 (Breaking Bad)", async () => {
    const play = await resolvePlayableSources({
      type: "tv",
      tmdbId: "1396",
      season: "1",
      episode: "1",
      firstSuccessOnly: true,
    });
    expect(play.sources.length).toBeGreaterThan(0);
    expect(play.type).toBe("tv");
  }, 90000);

  it("supports server switching to Oxygen", async () => {
    const play = await resolvePlayableSources({
      type: "movie",
      tmdbId: "27205",
      server: "Oxygen",
    });
    expect(play.sources.every((s) => s.provider === "Oxygen")).toBe(true);
  }, 90000);

  it("can query all servers", async () => {
    const play = await resolvePlayableSources({
      type: "movie",
      tmdbId: "27205",
      allServers: true,
    });
    const providers = new Set(play.sources.map((s) => s.provider));
    expect(providers.size).toBeGreaterThanOrEqual(1);
    expect(SERVER_PRIORITY.some((p) => providers.has(p))).toBe(true);
  }, 120000);
});
