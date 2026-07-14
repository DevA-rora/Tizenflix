import { describe, expect, it } from "vitest";
import { parseMaxManifestHeight } from "../src/proxy/rewrite-m3u8.js";

function wantsFhdPlaylist(canFhd: boolean, targetMaxHeight?: number): boolean {
  if (canFhd) return true;
  return typeof targetMaxHeight === "number" && targetMaxHeight >= 1080;
}

function buildPlaylistParams(
  token: string,
  expires: string,
  hasB: boolean,
  requestFhd: boolean,
  lang: string
): URLSearchParams {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (expires) params.set("expires", expires);
  if (hasB) params.set("b", "1");
  if (requestFhd) params.set("h", "1");
  params.set("lang", lang);
  return params;
}

describe("VixSrc FHD playlist params", () => {
  it("requests h=1 when target maxHeight is 1080 even without canPlayFHD", () => {
    expect(wantsFhdPlaylist(false, 1080)).toBe(true);
    const params = buildPlaylistParams("tok", "exp", true, wantsFhdPlaylist(false, 1080), "en");
    expect(params.get("h")).toBe("1");
  });

  it("does not request h=1 for 720p target without canPlayFHD", () => {
    expect(wantsFhdPlaylist(false, 720)).toBe(false);
    const params = buildPlaylistParams("tok", "exp", true, wantsFhdPlaylist(false, 720), "en");
    expect(params.get("h")).toBeNull();
  });

  it("detects when retried FHD manifest exceeds SD height", () => {
    const sd = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=1280x720
720p/index.m3u8`;
    const fhd = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=1280x720
720p/index.m3u8`;
    expect(parseMaxManifestHeight(sd)).toBe(720);
    expect(parseMaxManifestHeight(fhd)).toBe(1080);
    expect(parseMaxManifestHeight(fhd)).toBeGreaterThan(parseMaxManifestHeight(sd));
  });
});
