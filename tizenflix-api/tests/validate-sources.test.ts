import { describe, it, expect, vi } from "vitest";
import { validatePlaySources } from "../src/proxy/validate-sources.js";
import type { PlayResponse } from "../src/types.js";

const PUBLIC_BASE = "http://localhost:8790";

function samplePlay(): PlayResponse {
  return {
    title: "Inception",
    type: "movie",
    tmdbId: "27205",
    sources: [
      {
        id: "hydrogen-480p-0",
        provider: "Hydrogen",
        label: "480p",
        type: "m3u8",
        url: "https://cdn.example/hydrogen/480p.m3u8",
        priority: 0,
      },
      {
        id: "lithium-720p-0",
        provider: "Lithium",
        label: "720p",
        type: "mp4",
        url: "https://cdn.example/lithium/720p.mp4",
        priority: 1,
      },
      {
        id: "oxygen-720p-0",
        provider: "Oxygen",
        label: "720p",
        type: "m3u8",
        url: "https://cdn.example/oxygen/720p.m3u8",
        priority: 2,
      },
    ],
    recommended: "hydrogen-480p-0",
    subtitles: [],
    nextEpisode: null,
  };
}

function mockFetch(blockPattern?: RegExp) {
  return vi.fn(async (url: string) => {
    const manifest = "#EXTM3U\n#EXTINF:8,\nhttps://cdn.example/seg.ts";
    const blocked = blockPattern ? blockPattern.test(url) : url.includes("hydrogen");
    if (!blocked) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => (url.includes(".ts") ? "video/mp2t" : "application/vnd.apple.mpegurl") },
        text: async () => manifest,
      };
    }
    return {
      ok: false,
      status: 403,
      headers: { get: () => "text/html" },
      text: async () => "<html>403</html>",
    };
  }) as unknown as typeof fetch;
}

describe("validatePlaySources tizen profile", () => {
  it("prefers lower source priority and VixSrc over faster Vidking servers", async () => {
    const fetchImpl = mockFetch();
    const play: PlayResponse = {
      ...samplePlay(),
      sources: [
        {
          id: "vixsrc-720p-0",
          provider: "VixSrc/Server1",
          label: "720p",
          type: "m3u8",
          url: "https://cdn.example/vixsrc/720p.m3u8",
          priority: 0,
        },
        {
          id: "oxygen-720p-0",
          provider: "Oxygen",
          label: "720p",
          type: "m3u8",
          url: "https://cdn.example/oxygen/720p.m3u8",
          priority: 2,
        },
      ],
      recommended: "oxygen-720p-0",
    };

    const result = await validatePlaySources(play, PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
    });

    expect(result.sources[0]?.provider).toBe("VixSrc/Server1");
    expect(result.recommended).toBe("vixsrc-720p-0");
  });

  it("returns playable m3u8 only and skips MP4 without warnings", async () => {
    const fetchImpl = mockFetch();
    const result = await validatePlaySources(samplePlay(), PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.type).toBe("m3u8");
    expect(result.sources[0]?.provider).toBe("Oxygen");
    expect(result.recommended).toBe("oxygen-720p-0");
    expect(result.warnings).toEqual(["Hydrogen 480p: CDN returned HTTP 403"]);
  });

  it("emits a single concise warning when no HLS is playable", async () => {
    const fetchImpl = mockFetch(/.*/);
    const result = await validatePlaySources(samplePlay(), PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
    });

    expect(result.sources).toHaveLength(0);
    expect(result.recommended).toBeNull();
    expect(result.warnings).toEqual([
      "Hydrogen 480p: CDN returned HTTP 403",
      "Oxygen 720p: first segment HTTP 403",
      "No playable HLS stream for this title right now. Try again later.",
    ]);
  });

  it("keeps blocked sources and per-provider warnings without tizen profile", async () => {
    const fetchImpl = mockFetch(/.*/);
    const result = await validatePlaySources(samplePlay(), PUBLIC_BASE, fetchImpl, {
      tizenProfile: false,
    });

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.warnings?.some((w) => w.includes("mp4 is not supported"))).toBe(true);
    expect(result.warnings?.some((w) => w.includes("Hydrogen"))).toBe(true);
  });

  it("probes only probeLimit sources and keeps the rest as fallbacks", async () => {
    const fetchImpl = mockFetch();
    const play: PlayResponse = {
      ...samplePlay(),
      sources: [
        {
          id: "vixsrc-720p-0",
          provider: "VixSrc/Server1",
          label: "720p",
          type: "m3u8",
          url: "https://cdn.example/vixsrc/720p.m3u8",
          priority: 0,
        },
        {
          id: "oxygen-720p-0",
          provider: "Oxygen",
          label: "720p",
          type: "m3u8",
          url: "https://cdn.example/oxygen/720p.m3u8",
          priority: 2,
        },
      ],
      recommended: "vixsrc-720p-0",
    };

    const result = await validatePlaySources(play, PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
      probeLimit: 1,
    });

    expect(result.sources).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
