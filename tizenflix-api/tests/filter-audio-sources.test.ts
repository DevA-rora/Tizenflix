import { describe, expect, it } from "vitest";
import { filterSourcesByAudioLang } from "../src/normalize/filter-audio-sources.js";
import type { PlayableSource } from "../src/types.js";

function source(
  id: string,
  audioLanguage?: string,
  audioVariant?: PlayableSource["audioVariant"]
): PlayableSource {
  return {
    id,
    provider: id,
    label: id,
    type: "m3u8",
    url: `https://example.com/${id}.m3u8`,
    priority: 0,
    audioLanguage,
    audioVariant,
  };
}

describe("filterSourcesByAudioLang", () => {
  it("ranks matching Japanese original first", () => {
    const result = filterSourcesByAudioLang(
      [source("en-dub", "en", "dubbed"), source("ja-original", "ja", "original")],
      "ja",
      { preferOriginal: true, audioLangParam: "original" }
    );
    expect(result.matched).toBe(true);
    expect(result.sources[0]?.id).toBe("ja-original");
  });

  it("warns when no source matches preference", () => {
    const result = filterSourcesByAudioLang(
      [source("unknown", undefined, "unknown"), source("en-dub", "en", "dubbed")],
      "ja",
      { preferOriginal: true, audioLangParam: "original" }
    );
    expect(result.matched).toBe(false);
    expect(result.warning).toContain("Japanese");
    expect(result.sources.length).toBe(2);
  });
});
