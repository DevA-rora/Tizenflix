import { describe, expect, it } from "vitest";
import { inferAudioFromLabel, tagPlayableSource } from "../src/normalize/audio-metadata.js";

describe("inferAudioFromLabel", () => {
  it("detects Frembed VO as original", () => {
    const meta = inferAudioFromLabel("Voe (VO)", "frembed");
    expect(meta.audioVariant).toBe("original");
  });

  it("detects Frembed French dub", () => {
    const meta = inferAudioFromLabel("Dood (French)", "frembed");
    expect(meta.audioLanguage).toBe("fr");
    expect(meta.audioVariant).toBe("dubbed");
  });

  it("detects AfterDark vf dub", () => {
    const meta = inferAudioFromLabel("Premium • hd • vf");
    expect(meta.audioLanguage).toBe("fr");
    expect(meta.audioVariant).toBe("dubbed");
  });
});

describe("tagPlayableSource", () => {
  it("prefers structured video metadata over label inference", () => {
    const tagged = tagPlayableSource(
      {
        id: "1",
        provider: "Vidrock",
        label: "Atlas",
        type: "m3u8",
        url: "https://example.com/a.m3u8",
        priority: 0,
        sourceId: "vidrock",
      },
      { audioLanguage: "ja", audioVariant: "original" }
    );
    expect(tagged.audioLanguage).toBe("ja");
    expect(tagged.audioVariant).toBe("original");
  });
});
