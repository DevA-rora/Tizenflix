import { describe, expect, it } from "vitest";
import { detectPackedJs, unpackJs } from "../src/streamflix/network/js-unpacker.js";
import { isCloudflareChallenge } from "../src/streamflix/network/cf-detect.js";
import { solvePowChallenge } from "../src/streamflix/network/pow-solver.js";
import { resolveHostname } from "../src/streamflix/network/doh.js";
import { getCookieJar, setCookiesFromString } from "../src/streamflix/network/cookies.js";

const PACKED_SAMPLE =
  "eval(function(p,a,c,k,e,d){while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+c+'\\\\b','g'),k[c]);return p}('0 1 2;',3,3,'hello|packed|world'.split('|'),0,{}))";

describe("network stack", () => {
  it("detects packed JS", () => {
    expect(detectPackedJs(PACKED_SAMPLE)).toBe(true);
    expect(detectPackedJs("console.log('plain')")).toBe(false);
  });

  it("unpacks P.A.C.K.E.R. sample", () => {
    const out = unpackJs(PACKED_SAMPLE);
    expect(out).toBeTruthy();
    expect(out).toContain("hello");
  });

  it("detects Cloudflare HTML markers", () => {
    expect(isCloudflareChallenge(200, "<html>Just a moment...</html>")).toBe(true);
    expect(isCloudflareChallenge(403, "blocked")).toBe(true);
    expect(isCloudflareChallenge(200, "<html>OK</html>")).toBe(false);
  });

  it("solves trivial POW challenge", () => {
    const nonce = solvePowChallenge("test", 1, "salt", 50_000);
    expect(nonce).toBeTruthy();
  });

  it("resolves hostname via DoH fallback", async () => {
    const ips = await resolveHostname("cloudflare.com");
    expect(ips.length).toBeGreaterThan(0);
  });

  it("round-trips cookie jar", async () => {
    const jar = getCookieJar();
    await setCookiesFromString("https://example.com/", "foo=bar");
    const cookies = await jar.getCookies("https://example.com/");
    expect(cookies.some((c) => c.key === "foo")).toBe(true);
  });
});
