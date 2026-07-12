import { describe, expect, it } from "vitest";
import { getAllProviders, getEnabledProviders } from "../src/streamflix/providers/registry.js";
import { listExtractors } from "../src/streamflix/extractors/registry.js";

describe("streamflix registry", () => {
  it("registers all providers (63 Android + SuperStream)", () => {
    expect(getAllProviders().length).toBeGreaterThanOrEqual(63);
  });

  it("has enabled English movie providers", () => {
    const enabled = getEnabledProviders("movie").map((p) => p.id);
    expect(enabled).toContain("sflix");
    expect(enabled).toContain("ridomovies");
    expect(enabled).toContain("superstream");
    expect(enabled).toContain("streaming-community-en");
  });

  it("registers extractors", () => {
    const names = listExtractors();
    expect(names.length).toBeGreaterThan(10);
    expect(names).toContain("vixcloud");
    expect(names).toContain("MixDrop");
  });
});

const live = process.env.RUN_LIVE_BENCHMARK === "1";

describe.skipIf(!live)("benchmark integration", () => {
  it(
    "resolves Inception via parallel providers",
    async () => {
      const { resolveStreamflixPlay } = await import("../src/streamflix/resolve.js");
      const play = await resolveStreamflixPlay({
        type: "movie",
        tmdbId: "27205",
        title: "Inception",
        providerTimeoutMs: 20_000,
      });
      expect(play.providerResults?.length).toBeGreaterThan(0);
    },
    60_000
  );
});
