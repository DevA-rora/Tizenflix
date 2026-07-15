import { describe, it, expect, vi } from "vitest";
import { validatePlaySources, parseHeightFromLabel } from "../src/proxy/validate-sources.js";
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
      "Oxygen 720p: CDN returned HTTP 403",
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

  it("prefers higher resolution labels over faster lower-resolution probes", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const manifest = "#EXTM3U\n#EXTINF:8,\nhttps://cdn.example/seg.ts";
      const slow = url.includes("1080");
      if (slow) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => (url.includes(".ts") ? "video/mp2t" : "application/vnd.apple.mpegurl") },
        text: async () => manifest,
      };
    }) as unknown as typeof fetch;

    const play: PlayResponse = {
      ...samplePlay(),
      sources: [
        {
          id: "oxygen-720p-0",
          provider: "Oxygen",
          label: "720p",
          type: "m3u8",
          url: "https://cdn.example/oxygen/720p.m3u8",
          priority: 0,
        },
        {
          id: "oxygen-1080p-0",
          provider: "Oxygen",
          label: "1080p",
          type: "m3u8",
          url: "https://cdn.example/oxygen/1080p.m3u8",
          priority: 0,
        },
      ],
      recommended: "oxygen-720p-0",
    };

    const result = await validatePlaySources(play, PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
    });

    expect(result.recommended).toBe("oxygen-1080p-0");
    expect(result.sources[0]?.label).toBe("1080p");
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

  it("keeps unverified Hydrogen when upstreamHeaders are present on tizen profile", async () => {
    const fetchImpl = mockFetch();
    const play: PlayResponse = {
      ...samplePlay(),
      sources: [
        {
          id: "hydrogen-480p-0",
          provider: "Hydrogen",
          label: "480p",
          type: "m3u8",
          url: "https://cdn.example/hydrogen/480p.m3u8",
          priority: 0,
          upstreamHeaders: {
            Referer: "https://www.fmovies.gd/",
            Origin: "https://www.fmovies.gd",
          },
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
    };

    const result = await validatePlaySources(play, PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
    });

    expect(result.sources).toHaveLength(2);
    expect(result.sources.some((s) => s.provider === "Hydrogen")).toBe(true);
    expect(result.warnings?.some((w) => w.includes("unverified"))).toBe(true);
  });

  it("sends Referer from upstreamHeaders during probe", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = (init?.headers as Record<string, string>) ?? {};
      if (h.Referer === "https://embed.example/") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/vnd.apple.mpegurl" },
          text: async () => "#EXTM3U\n#EXTINF:8,\nhttps://cdn.example/seg.ts",
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      return {
        ok: false,
        status: 403,
        headers: { get: () => "text/html" },
        text: async () => "<html>403</html>",
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }) as unknown as typeof fetch;

    const play: PlayResponse = {
      ...samplePlay(),
      sources: [
        {
          id: "embed-720p-0",
          provider: "SFlix",
          label: "720p",
          type: "m3u8",
          url: "https://cdn.example/embed/720p.m3u8",
          priority: 0,
          upstreamHeaders: {
            Referer: "https://embed.example/",
            "User-Agent": "EmbedUA/1.0",
          },
        },
      ],
      recommended: "embed-720p-0",
    };

    const result = await validatePlaySources(play, PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.provider).toBe("SFlix");
    const withReferer = fetchImpl.mock.calls.some((call) => {
      const h = (call[1] as RequestInit)?.headers as Record<string, string>;
      return h?.Referer === "https://embed.example/";
    });
    expect(withReferer).toBe(true);
  });
});

describe("parseHeightFromLabel", () => {
  it("parses 4K and 2160p labels as 2160", () => {
    expect(parseHeightFromLabel("4K")).toBe(2160);
    expect(parseHeightFromLabel("2160p")).toBe(2160);
    expect(parseHeightFromLabel("1080p")).toBe(1080);
  });
});

describe("validatePlaySources preferredQuality", () => {
  it("prefers 1080p over faster 720p when preferredQuality is set", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const manifest = "#EXTM3U\n#EXTINF:8,\nhttps://cdn.example/seg.ts";
      const slow = url.includes("1080");
      if (slow) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => (url.includes(".ts") ? "video/mp2t" : "application/vnd.apple.mpegurl") },
        text: async () => manifest,
      };
    }) as unknown as typeof fetch;

    const play: PlayResponse = {
      ...samplePlay(),
      sources: [
        {
          id: "oxygen-720p-0",
          provider: "Oxygen",
          label: "720p",
          type: "m3u8",
          url: "https://cdn.example/oxygen/720p.m3u8",
          priority: 0,
        },
        {
          id: "oxygen-1080p-0",
          provider: "Oxygen",
          label: "1080p",
          type: "m3u8",
          url: "https://cdn.example/oxygen/1080p.m3u8",
          priority: 0,
        },
      ],
      recommended: "oxygen-720p-0",
    };

    const result = await validatePlaySources(play, PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
      preferredQuality: "1080p",
    });

    expect(result.recommended).toBe("oxygen-1080p-0");
    expect(result.sources[0]?.label).toBe("1080p");
  });

  it("prefers manifest 1080p over faster Auto-labeled 720p when preferredQuality is set", async () => {
    const master720 = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=1280x720
720p/index.m3u8
#EXTINF:8,
https://cdn.example/seg.ts`;
    const master1080 = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXTINF:8,
https://cdn.example/seg.ts`;

    const fetchImpl = vi.fn(async (url: string) => {
      const slow = url.includes("1080");
      if (slow) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      const body = url.includes("1080") ? master1080 : master720;
      return {
        ok: true,
        status: 200,
        headers: { get: () => (url.includes(".ts") ? "video/mp2t" : "application/vnd.apple.mpegurl") },
        text: async () => body,
      };
    }) as unknown as typeof fetch;

    const play: PlayResponse = {
      ...samplePlay(),
      sources: [
        {
          id: "vix-auto-0",
          provider: "VixSrc/Server 1",
          label: "Auto",
          type: "m3u8",
          url: "https://cdn.example/vix/auto.m3u8",
          priority: 0,
        },
        {
          id: "vix-auto-1",
          provider: "VixSrc/Server 2",
          label: "Auto",
          type: "m3u8",
          url: "https://cdn.example/vix/1080.m3u8",
          priority: 1,
        },
      ],
      recommended: "vix-auto-0",
    };

    const result = await validatePlaySources(play, PUBLIC_BASE, fetchImpl, {
      tizenProfile: true,
      preferredQuality: "1080p",
    });

    expect(result.recommended).toBe("vix-auto-1");
    expect(result.sources[0]?.id).toBe("vix-auto-1");
  });
});
