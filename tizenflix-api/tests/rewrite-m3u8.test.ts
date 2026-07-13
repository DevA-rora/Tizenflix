import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { rewriteM3u8, shouldRewriteAsM3u8, simplifyMasterForTv } from "../src/proxy/rewrite-m3u8.js";
import { buildProxyUrl, resolvePlaylistUrl } from "../src/proxy/proxy-url.js";

const PUBLIC_BASE = "http://192.168.1.10:8790";
const MANIFEST_URL =
  "https://moon.ironbubble.site/r2/cdn2/example/480p/index.m3u8";

describe("shouldRewriteAsM3u8", () => {
  it("requires #EXTM3U body (not URL alone)", () => {
    expect(
      shouldRewriteAsM3u8(
        "https://example.com/index.m3u8",
        "text/html",
        "<html><title>403 Forbidden</title></html>"
      )
    ).toBe(false);
  });

  it("accepts real manifest body", () => {
    expect(
      shouldRewriteAsM3u8(
        "https://example.com/index.m3u8",
        "text/html",
        "#EXTM3U\n#EXTINF:8,\nseg.ts"
      )
    ).toBe(true);
  });
});

describe("simplifyMasterForTv", () => {
  it("keeps one English audio track and highest bandwidth video up to 1080p", () => {
    const input = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Eng.Original",DEFAULT=YES,LANGUAGE="en",URI="audio-en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Russian",DEFAULT=NO,LANGUAGE="ru",URI="audio-ru.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=1280x720,AUDIO="audio0"
high/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=640x360,AUDIO="audio0"
low/index.m3u8`;

    const out = simplifyMasterForTv(input);
    expect(out).toContain("Eng.Original");
    expect(out).not.toContain("Russian");
    expect(out).toContain("high/index.m3u8");
    expect(out).toContain("low/index.m3u8");
  });

  it("keeps up to three quality rungs for ABR", () => {
    const input = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Eng.Original",DEFAULT=YES,LANGUAGE="en",URI="audio-en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=1280x720,AUDIO="audio0"
high/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=854x480,AUDIO="audio0"
mid/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=640x360,AUDIO="audio0"
low/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=150000,RESOLUTION=426x240,AUDIO="audio0"
tiny/index.m3u8`;

    const out = simplifyMasterForTv(input, 3);
    expect(out).toContain("high/index.m3u8");
    expect(out).toContain("mid/index.m3u8");
    expect(out).toContain("low/index.m3u8");
    expect(out).not.toContain("tiny/index.m3u8");
  });

  it("prefers Japanese audio when requested", () => {
    const input = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="English",DEFAULT=YES,LANGUAGE="en",URI="audio-en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Japanese",DEFAULT=NO,LANGUAGE="ja",URI="audio-ja.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=1280x720,AUDIO="audio0"
high/index.m3u8`;

    const out = simplifyMasterForTv(input, { preferredAudioLang: "ja" });
    expect(out).toContain("Japanese");
    expect(out).not.toContain('LANGUAGE="en"');
  });

  it("keeps 4K rung when maxHeight is 2160", () => {
    const input = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Eng.Original",DEFAULT=YES,LANGUAGE="en",URI="audio-en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=15000000,RESOLUTION=3840x2160,AUDIO="audio0"
4k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,AUDIO="audio0"
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=1280x720,AUDIO="audio0"
720p/index.m3u8`;

    const capped = simplifyMasterForTv(input, { maxHeight: 1080 });
    expect(capped).not.toContain("4k/index.m3u8");
    expect(capped).toContain("1080p/index.m3u8");

    const full = simplifyMasterForTv(input, { maxHeight: 2160 });
    expect(full).toContain("4k/index.m3u8");
    expect(full).toContain("1080p/index.m3u8");
  });
});

describe("rewriteM3u8", () => {
  it("rewrites absolute segment URLs through proxy", () => {
    const input = `#EXTM3U
#EXTINF:8.0,
https://cartlegion03.site/segment-001.ts
#EXTINF:8.0,
https://losangeles14.site/segment-002.ts`;

    const out = rewriteM3u8(input, MANIFEST_URL, PUBLIC_BASE);
    expect(out).toContain(
      buildProxyUrl(PUBLIC_BASE, "https://cartlegion03.site/segment-001.ts")
    );
    expect(out).toContain(
      buildProxyUrl(PUBLIC_BASE, "https://losangeles14.site/segment-002.ts")
    );
    expect(out).not.toContain("https://cartlegion03.site/segment-001.ts\n");
  });

  it("rewrites URI attributes in tags", () => {
    const input = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/eng.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1280000
720p/index.m3u8`;

    const out = rewriteM3u8(input, MANIFEST_URL, PUBLIC_BASE);
    expect(out).toContain(
      `URI="${buildProxyUrl(PUBLIC_BASE, "https://moon.ironbubble.site/r2/cdn2/example/480p/audio/eng.m3u8")}"`
    );
    expect(out).toContain(
      buildProxyUrl(
        PUBLIC_BASE,
        "https://moon.ironbubble.site/r2/cdn2/example/480p/720p/index.m3u8"
      )
    );
  });

  it("rewrites real captured manifest with no bare CDN URLs", () => {
    const fixture = join(process.cwd(), "fixtures/inception-480p.m3u8");
    if (!existsSync(fixture)) return;

    const input = readFileSync(fixture, "utf-8");
    const out = rewriteM3u8(input, MANIFEST_URL, PUBLIC_BASE);

    expect(out.startsWith("#EXTM3U")).toBe(true);
    expect(out).toContain(`${PUBLIC_BASE}/proxy/stream?url=`);

    const bareCdn = [
      "cartlegion03.site",
      "losangeles14.site",
      "diskphone12.site",
    ];
    for (const host of bareCdn) {
      const lines = out.split("\n").filter((l) => !l.startsWith("#") && l.trim());
      for (const line of lines) {
        expect(line).not.toMatch(new RegExp(`^https?://${host}`));
      }
    }
  });
});

describe("resolvePlaylistUrl", () => {
  it("resolves relative paths", () => {
    expect(resolvePlaylistUrl(MANIFEST_URL, "720p/index.m3u8")).toBe(
      "https://moon.ironbubble.site/r2/cdn2/example/480p/720p/index.m3u8"
    );
  });
});
