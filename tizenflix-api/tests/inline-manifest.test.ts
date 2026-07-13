import { describe, expect, it } from "vitest";
import {
  getInlineManifest,
  INLINE_MANIFEST_PREFIX,
  isInlineManifestSource,
  storeInlineManifest,
} from "../src/cache/inline-manifest-cache.js";
import { patchVixSrcPlaylist } from "../src/streamflix/extractors/vix-src-playlist.js";

describe("inline manifest cache", () => {
  it("stores and retrieves manifest bodies", () => {
    const token = storeInlineManifest("#EXTM3U\n", "https://vixsrc.to/playlist/1.m3u8", "https://vixsrc.to/");
    expect(isInlineManifestSource(`${INLINE_MANIFEST_PREFIX}${token}`)).toBe(true);
    const entry = getInlineManifest(token);
    expect(entry?.body).toBe("#EXTM3U\n");
    expect(entry?.upstreamUrl).toContain("playlist");
  });
});

describe("patchVixSrcPlaylist", () => {
  it("resolves relative segment URLs to absolute", () => {
    const body = ["#EXTM3U", "#EXT-X-STREAM-INF:BANDWIDTH=1000", "720p/index.m3u8"].join("\n");
    const patched = patchVixSrcPlaylist(body, "https://vixsrc.to/playlist/99.m3u8?token=x");
    expect(patched).toContain("https://vixsrc.to/playlist/720p/index.m3u8");
  });
});
