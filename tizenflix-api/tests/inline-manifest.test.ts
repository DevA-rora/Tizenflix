import { describe, expect, it } from "vitest";
import {
  getInlineManifest,
  INLINE_MANIFEST_PREFIX,
  isInlineManifestSource,
  storeInlineManifest,
} from "../src/cache/inline-manifest-cache.js";
import { buildProxyUrl } from "../src/proxy/proxy-url.js";
import { patchVixSrcPlaylist } from "../src/streamflix/extractors/vix-src-playlist.js";

const PUBLIC_BASE = "http://192.168.1.10:8790";

function proxyWrapInline(
  publicBase: string,
  url: string,
  audioLang?: string,
  maxHeight?: number
): string {
  if (!isInlineManifestSource(url)) return url;
  const token = url.slice(INLINE_MANIFEST_PREFIX.length);
  let inlineUrl = `${publicBase.replace(/\/$/, "")}/proxy/inline-manifest/${token}`;
  const params = new URLSearchParams();
  if (audioLang) params.set("audioLang", audioLang);
  if (maxHeight && maxHeight > 0) params.set("maxHeight", String(maxHeight));
  const qs = params.toString();
  if (qs) inlineUrl += `?${qs}`;
  return inlineUrl;
}

describe("inline manifest cache", () => {
  it("stores and retrieves manifest bodies", () => {
    const token = storeInlineManifest("#EXTM3U\n", "https://vixsrc.to/playlist/1.m3u8", "https://vixsrc.to/");
    expect(isInlineManifestSource(`${INLINE_MANIFEST_PREFIX}${token}`)).toBe(true);
    const entry = getInlineManifest(token);
    expect(entry?.body).toBe("#EXTM3U\n");
    expect(entry?.upstreamUrl).toContain("playlist");
  });

  it("proxy inline URLs include maxHeight query param", () => {
    const token = storeInlineManifest("#EXTM3U\n", "https://vixsrc.to/playlist/1.m3u8", "https://vixsrc.to/");
    const proxied = proxyWrapInline(PUBLIC_BASE, `${INLINE_MANIFEST_PREFIX}${token}`, "en", 1080);
    expect(proxied).toContain("/proxy/inline-manifest/");
    expect(proxied).toContain("maxHeight=1080");
    expect(proxied).toContain("audioLang=en");
  });

  it("regular proxy URLs still include maxHeight", () => {
    const proxied = buildProxyUrl(PUBLIC_BASE, "https://cdn.example/master.m3u8", undefined, "en", 1080);
    expect(proxied).toContain("maxHeight=1080");
  });
});

describe("patchVixSrcPlaylist", () => {
  it("resolves relative segment URLs to absolute", () => {
    const body = ["#EXTM3U", "#EXT-X-STREAM-INF:BANDWIDTH=1000", "720p/index.m3u8"].join("\n");
    const patched = patchVixSrcPlaylist(body, "https://vixsrc.to/playlist/99.m3u8?token=x");
    expect(patched).toContain("https://vixsrc.to/playlist/720p/index.m3u8");
  });
});
