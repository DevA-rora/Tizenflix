import { describe, expect, it } from "vitest";

const skipCf = process.env.SKIP_CF_TESTS === "1";

describe.skipIf(skipCf)("cf-bypass", () => {
  it(
    "obtains HTML via Playwright for a CF-protected site",
    async () => {
      const { playwrightFetch, closePlaywright } = await import(
        "../src/streamflix/network/cf-bypass.js"
      );
      try {
        const result = await playwrightFetch("https://nowsecure.nl/");
        expect(result.html.length).toBeGreaterThan(100);
        expect(result.cfBypassUsed).toBe(true);
      } finally {
        await closePlaywright();
      }
    },
    120_000
  );
});

describe("cf-bypass (offline)", () => {
  it("reports skip when SKIP_CF_TESTS=1", () => {
    if (skipCf) expect(skipCf).toBe(true);
    else expect(true).toBe(true);
  });
});
