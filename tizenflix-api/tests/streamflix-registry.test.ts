import { describe, expect, it } from "vitest";
import { listExtractors } from "../src/streamflix/extractors/registry.js";

describe("streamflix extractor registry", () => {
  it("lists ported extractors", () => {
    const names = listExtractors();
    expect(names).toContain("Vidplay");
    expect(names).toContain("Streamtape");
    expect(names).toContain("VOE");
    expect(names).toContain("Filemoon");
    expect(names).toContain("Rabbitstream");
  });
});
