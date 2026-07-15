import { describe, it, expect } from "vitest";
import { buildProxyUrl, parseProxyHeaderQuery } from "../src/proxy/proxy-url.js";

const PUBLIC_BASE = "http://localhost:8790";

describe("buildProxyUrl header params", () => {
  it("encodes referer, userAgent, origin, and cookie", () => {
    const url = buildProxyUrl(PUBLIC_BASE, "https://cdn.example/a.m3u8", {
      referer: "https://www.fmovies.gd/",
      userAgent: "Mozilla/5.0",
      origin: "https://www.fmovies.gd",
      cookie: "sid=abc",
    });
    expect(url).toContain("referer=");
    expect(url).toContain("userAgent=");
    expect(url).toContain("origin=");
    expect(url).toContain("cookie=");
  });

  it("round-trips parseProxyHeaderQuery", () => {
    const built = buildProxyUrl(PUBLIC_BASE, "https://cdn.example/a.m3u8", {
      referer: "https://www.fmovies.gd/",
      userAgent: "Mozilla/5.0",
      cookie: "sid=abc",
    });
    const qs = new URL(built).searchParams;
    const parsed = parseProxyHeaderQuery({
      referer: qs.get("referer") ?? undefined,
      userAgent: qs.get("userAgent") ?? undefined,
      cookie: qs.get("cookie") ?? undefined,
    });
    expect(parsed?.referer).toBe("https://www.fmovies.gd/");
    expect(parsed?.userAgent).toBe("Mozilla/5.0");
    expect(parsed?.cookie).toBe("sid=abc");
  });
});
