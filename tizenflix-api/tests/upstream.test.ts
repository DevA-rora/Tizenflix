import { describe, it, expect, vi } from "vitest";
import {
  buildUpstreamHeaders,
  fetchProxiedStream,
  fetchUpstreamWithRefererFallback,
  BARE_UPSTREAM_HEADERS,
} from "../src/proxy/upstream.js";

const PUBLIC_BASE = "http://localhost:8790";
const CDN_URL = "https://moon.ironbubble.site/r2/cdn2/example/index.m3u8";
const MANIFEST = "#EXTM3U\n#EXTINF:8,\nhttps://cdn.example/seg.ts\n";

function headersRecord(init?: RequestInit): Record<string, string> {
  return (init?.headers as Record<string, string>) ?? {};
}

describe("fetchUpstreamWithRefererFallback", () => {
  it("uses bare UA first for ironbubble hosts (no Origin/Referer)", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = headersRecord(init);
      expect(h.Origin).toBeUndefined();
      expect(h.Referer).toBeUndefined();
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/vnd.apple.mpegurl" },
        arrayBuffer: async () => new TextEncoder().encode(MANIFEST).buffer,
        text: async () => MANIFEST,
      };
    }) as unknown as typeof fetch;

    const res = await fetchUpstreamWithRefererFallback(CDN_URL, fetchImpl);
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(headersRecord(fetchImpl.mock.calls[0]![1] as RequestInit)["User-Agent"]).toBe(
      (BARE_UPSTREAM_HEADERS as Record<string, string>)["User-Agent"]
    );
  });

  it("tries site referer ladder after ironbubble bare UA 403", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = headersRecord(init);
      if (!h.Referer) {
        return {
          ok: false,
          status: 403,
          headers: { get: () => "text/html" },
          arrayBuffer: async () => new ArrayBuffer(0),
          text: async () => "<html>403</html>",
        };
      }
      if (h.Referer === "https://www.fmovies.gd/") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/vnd.apple.mpegurl" },
          arrayBuffer: async () => new TextEncoder().encode(MANIFEST).buffer,
          text: async () => MANIFEST,
        };
      }
      return {
        ok: false,
        status: 403,
        headers: { get: () => "text/html" },
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => "<html>403</html>",
      };
    }) as unknown as typeof fetch;

    const res = await fetchUpstreamWithRefererFallback(CDN_URL, fetchImpl);
    expect(res.status).toBe(200);
    const withReferer = fetchImpl.mock.calls.filter((call) => {
      const h = headersRecord(call[1] as RequestInit);
      return Boolean(h.Referer);
    });
    expect(withReferer.length).toBeGreaterThan(0);
    expect(headersRecord(withReferer[0]![1] as RequestInit).Referer).toBe(
      "https://www.fmovies.gd/"
    );
  });

  it("forwards custom User-Agent and Cookie on non-ironbubble hosts", async () => {
    const otherCdn = "https://cdn.example.com/index.m3u8";
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/vnd.apple.mpegurl" },
      text: async () => MANIFEST,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;

    await fetchUpstreamWithRefererFallback(otherCdn, fetchImpl, {
      referer: "https://www.2embed.cc/",
      userAgent: "CustomUA/1.0",
      cookie: "sid=abc",
    });

    const h = headersRecord(fetchImpl.mock.calls[0]![1] as RequestInit);
    expect(h.Referer).toBe("https://www.2embed.cc/");
    expect(h["User-Agent"]).toBe("CustomUA/1.0");
    expect(h.Cookie).toBe("sid=abc");
  });

  it("retries without Origin/Referer after HTTP 403 on non-ironbubble hosts", async () => {
    const otherCdn = "https://cdn.example.com/r2/index.m3u8";
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = headersRecord(init);
      if (h.Origin || h.Referer) {
        return {
          ok: false,
          status: 403,
          headers: { get: () => "text/html" },
          arrayBuffer: async () => new ArrayBuffer(0),
          text: async () => "<html>403</html>",
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/vnd.apple.mpegurl" },
        arrayBuffer: async () => new TextEncoder().encode(MANIFEST).buffer,
        text: async () => MANIFEST,
      };
    }) as unknown as typeof fetch;

    const res = await fetchUpstreamWithRefererFallback(otherCdn, fetchImpl);
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const firstHeaders = headersRecord(fetchImpl.mock.calls[0]![1] as RequestInit);
    expect(firstHeaders.Origin).toBe("https://www.vidking.net");
    expect(firstHeaders.Referer).toBe("https://www.vidking.net/");

    const secondHeaders = headersRecord(fetchImpl.mock.calls[1]![1] as RequestInit);
    expect(secondHeaders.Origin).toBeUndefined();
    expect(secondHeaders.Referer).toBeUndefined();
    expect(secondHeaders["User-Agent"]).toBe(
      (BARE_UPSTREAM_HEADERS as Record<string, string>)["User-Agent"]
    );
  });

  it("does not retry when first response is 200", async () => {
    const otherCdn = "https://cdn.example.com/index.m3u8";
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/vnd.apple.mpegurl" },
      arrayBuffer: async () => new TextEncoder().encode(MANIFEST).buffer,
      text: async () => MANIFEST,
    })) as unknown as typeof fetch;

    const res = await fetchUpstreamWithRefererFallback(otherCdn, fetchImpl);
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("uses custom referer on the first try for non-ironbubble hosts", async () => {
    const otherCdn = "https://cdn.example.com/index.m3u8";
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/vnd.apple.mpegurl" },
      arrayBuffer: async () => new ArrayBuffer(0),
      text: async () => MANIFEST,
    })) as unknown as typeof fetch;

    await fetchUpstreamWithRefererFallback(otherCdn, fetchImpl, {
      referer: "https://player.videasy.net/",
    });

    const firstHeaders = headersRecord(fetchImpl.mock.calls[0]![1] as RequestInit);
    expect(firstHeaders.Referer).toBe("https://player.videasy.net/");
    expect(firstHeaders.Origin).toBe("https://player.videasy.net");
  });
});

describe("fetchProxiedStream referer fallback", () => {
  it("returns rewritten m3u8 for ironbubble via bare UA", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = headersRecord(init);
      expect(h.Origin).toBeUndefined();
      expect(h.Referer).toBeUndefined();
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/vnd.apple.mpegurl" },
        arrayBuffer: async () => new TextEncoder().encode(MANIFEST).buffer,
        text: async () => MANIFEST,
      };
    }) as unknown as typeof fetch;

    const result = await fetchProxiedStream(CDN_URL, PUBLIC_BASE, fetchImpl);
    expect(result.status).toBe(200);
    expect(result.rewritten).toBe(true);
    expect(typeof result.body).toBe("string");
    expect(String(result.body)).toContain("#EXTM3U");
    expect(String(result.body)).toContain("/proxy/stream?url=");
  });
});

describe("buildUpstreamHeaders", () => {
  it("defaults to Vidking Origin/Referer", () => {
    const h = buildUpstreamHeaders() as Record<string, string>;
    expect(h.Origin).toBe("https://www.vidking.net");
    expect(h.Referer).toBe("https://www.vidking.net/");
  });
});

describe("prefersBareUpstreamHeaders", () => {
  it("detects ironbubble hosts", async () => {
    const { prefersBareUpstreamHeaders } = await import("../src/proxy/upstream.js");
    expect(prefersBareUpstreamHeaders(CDN_URL)).toBe(true);
    expect(prefersBareUpstreamHeaders("https://cdn.example.com/x.m3u8")).toBe(false);
  });
});
