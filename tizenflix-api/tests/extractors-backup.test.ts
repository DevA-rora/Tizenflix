import { describe, expect, it } from "vitest";
import { vidrockCrypto } from "../src/streamflix/extractors/vidrock.js";
import { vidzeeCrypto } from "../src/streamflix/extractors/vidzee.js";
import { vidsrcNetDecrypt } from "../src/streamflix/extractors/vidsrc-net.js";
import { vidsrcToCrypto } from "../src/streamflix/extractors/vidsrc-to.js";
import { AUTO_TMDB_SOURCE_IDS } from "../src/streamflix/tmdb-native/auto-sources.js";

describe("vidrock crypto", () => {
  it("decrypts AES-GCM url blobs (iv + ciphertext+tag)", async () => {
    const res = await fetch("https://vidrock.net/api/movie/27205", {
      headers: { Referer: "https://vidrock.net/", "User-Agent": "Mozilla/5.0" },
    });
    const json = (await res.json()) as Record<string, { url?: string }>;
    const enc = Object.values(json).find((v) => v?.url)?.url;
    expect(enc).toBeTruthy();
    const plain = vidrockCrypto.decryptVidrockUrl(enc!);
    expect(plain.startsWith("http")).toBe(true);
  });
});

describe("vidzee crypto", () => {
  it("uses updated static pass constant", () => {
    expect(vidzeeCrypto.STATIC_PASS).toBe("c4a8f1d7e2b9a6c3d0f5e8a1b7c4d9e2");
  });

  it("decrypts master key from api-key endpoint", async () => {
    const res = await fetch("https://core.vidzee.wtf/api-key", {
      headers: {
        Origin: "https://player.vidzee.wtf",
        Referer: "https://player.vidzee.wtf/",
        "User-Agent": "Mozilla/5.0",
      },
    });
    const b64 = await res.text();
    const key = vidzeeCrypto.decryptGcmMasterKey(b64);
    expect(key.length).toBeGreaterThan(0);
  });
});

describe("vidsrcnet decrypt", () => {
  it("reverses 3-char chunk algorithm", () => {
    const out = vidsrcNetDecrypt("NdonQLf1Tzyx7bMG", "abcdefghi");
    expect(out).toBe("ghidefabc");
  });
});

describe("vidsrc.to crypto", () => {
  it("encodeKey is deterministic", () => {
    const a = vidsrcToCrypto.encodeKey("testkey", "media123");
    const b = vidsrcToCrypto.encodeKey("testkey", "media123");
    expect(a).toBe(b);
    expect(a).not.toContain("+");
    expect(a).not.toContain("/");
  });
});

describe("auto sources", () => {
  it("lists proven TMDB-native backups in priority order", () => {
    expect(AUTO_TMDB_SOURCE_IDS).toEqual(["vixsrc", "vidzee", "vidrock"]);
  });
});
