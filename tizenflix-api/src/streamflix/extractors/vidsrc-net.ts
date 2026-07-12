import * as cheerio from "cheerio";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { interceptEmbedRequest } from "./base/playwright-embed.js";

const MAIN_URL = "https://vidsrc-embed.ru";

function decrypt(id: string, encrypted: string): string {
  switch (id) {
    case "NdonQLf1Tzyx7bMG": {
      const chunks: string[] = [];
      for (let d = 0; d < encrypted.length; d += 3) {
        chunks.push(encrypted.substring(d, Math.min(d + 3, encrypted.length)));
      }
      return chunks.reverse().join("");
    }
    case "sXnL9MQIry": {
      const b = "pWB9V)[*4I`nJpp?ozyB~dbr9yt!_n4u";
      const d = encrypted.match(/.{2}/g)!.map((h) => String.fromCharCode(parseInt(h, 16))).join("");
      let c = "";
      for (let e = 0; e < d.length; e++) c += String.fromCharCode(d.charCodeAt(e) ^ b.charCodeAt(e % b.length));
      let out = "";
      for (const ch of c) out += String.fromCharCode(ch.charCodeAt(0) - 3);
      return Buffer.from(out, "base64").toString("utf8");
    }
    case "IhWrImMIGL": {
      const rot = (ch: string) => {
        const c = ch.charCodeAt(0);
        if ((c >= 97 && c <= 109) || (c >= 65 && c <= 77)) return String.fromCharCode(c + 13);
        if ((c >= 110 && c <= 122) || (c >= 78 && c <= 90)) return String.fromCharCode(c - 13);
        return ch;
      };
      const b = encrypted.split("").reverse().join("");
      const c = b.split("").map(rot).join("");
      return Buffer.from(c.split("").reverse().join(""), "base64").toString("utf8");
    }
    case "xTyBxQyGTA": {
      const b = encrypted.split("").reverse().join("");
      const c = b.split("").filter((_, i) => i % 2 === 0).join("");
      return Buffer.from(c, "base64").toString("utf8");
    }
    case "ux8qjPHC66": {
      const b = encrypted.split("").reverse().join("");
      const c = "X9a(O;FMV2-7VO5x;Ao\x05:dN1NoFs?j,";
      const d = b.match(/.{2}/g)!.map((h) => String.fromCharCode(parseInt(h, 16))).join("");
      let e = "";
      for (let i = 0; i < d.length; i++) e += String.fromCharCode(d.charCodeAt(i) ^ c.charCodeAt(i % c.length));
      return e;
    }
    case "eSfH1IRMyL": {
      const b = encrypted.split("").reverse().join("");
      const c = b.split("").map((ch) => String.fromCharCode(ch.charCodeAt(0) - 1)).join("");
      return c
        .match(/.{2}/g)!
        .map((h) => String.fromCharCode(parseInt(h, 16)))
        .join("");
    }
    case "KJHidj7det": {
      const b = encrypted.substring(10, encrypted.length - 16);
      const c = '3SAY~#%Y(V%>5d/Yg"$G[Lh1rK4a;7ok';
      const d = Buffer.from(b, "base64").toString("utf8");
      const e = c.repeat(Math.ceil(d.length / c.length)).slice(0, d.length);
      let f = "";
      for (let i = 0; i < d.length; i++) f += String.fromCharCode(d.charCodeAt(i) ^ e.charCodeAt(i));
      return f;
    }
    case "o2VSUnjnZl": {
      const shift = 3;
      return encrypted
        .split("")
        .map((char) => {
          const code = char.charCodeAt(0);
          if (code >= 97 && code <= 122) {
            const shifted = code - shift;
            return String.fromCharCode(shifted < 97 ? shifted + 26 : shifted);
          }
          if (code >= 65 && code <= 90) {
            const shifted = code - shift;
            return String.fromCharCode(shifted < 65 ? shifted + 26 : shifted);
          }
          return char;
        })
        .join("");
    }
    case "Oi3v1dAlaM": {
      const b = encrypted.split("").reverse().join("");
      const c = b.replace(/-/g, "+").replace(/_/g, "/");
      const d = Buffer.from(c, "base64").toString("utf8");
      let e = "";
      for (const ch of d) e += String.fromCharCode(ch.charCodeAt(0) - 5);
      return e;
    }
    case "TsA2KGDGux": {
      const b = encrypted.split("").reverse().join("");
      const c = b.replace(/-/g, "+").replace(/_/g, "/");
      const d = Buffer.from(c, "base64").toString("utf8");
      let e = "";
      for (const ch of d) e += String.fromCharCode(ch.charCodeAt(0) - 7);
      return e;
    }
    case "JoAHUMCLXV": {
      const b = encrypted.split("").reverse().join("");
      const c = b.replace(/-/g, "+").replace(/_/g, "/");
      const d = Buffer.from(c, "base64").toString("utf8");
      let e = "";
      for (const ch of d) e += String.fromCharCode(ch.charCodeAt(0) - 3);
      return e;
    }
  }
  const plain = encrypted.match(/file:\s*"([^"]+)"/)?.[1];
  if (plain) return plain;
  throw new Error(`Vidsrc.net decrypt not implemented: ${id}`);
}

function parseSubtitles(script: string, iframeUrl: string) {
  const raw = script.match(/default_subtitles\s*=\s*["']([^"']+)["']/)?.[1];
  if (!raw) return [];
  let baseUrl: string;
  try {
    const u = new URL(iframeUrl);
    baseUrl = `${u.protocol}//${u.host}`;
  } catch {
    return [];
  }
  return raw
    .split(",")
    .map((item) => {
      const language = item.substring(item.indexOf("[") + 1, item.indexOf("]"));
      const path = item.substring(item.indexOf("]") + 1);
      if (!path.startsWith("/")) return null;
      return { label: language, file: `${baseUrl}${path}` };
    })
    .filter((s): s is { label: string; file: string } => Boolean(s));
}

async function extractVidsrcNet(link: string, referer = link) {
  try {
    return await extractVidsrcNetHttp(link, referer);
  } catch {
    const hit = await interceptEmbedRequest(link, [{ pattern: /\.m3u8/i, type: "m3u8" }], 45_000);
    return {
      source: hit.url,
      subtitles: [],
      headers: { Referer: link },
      type: "m3u8" as const,
    };
  }
}

async function extractVidsrcNetHttp(link: string, referer = link) {
  const html = await fetchText(link, { referer });
  const $ = cheerio.load(html);
  let iframeSrc = $("#player_iframe").attr("src") ?? $("iframe").attr("src");
  if (!iframeSrc) throw new Error("Vidsrc.net: iframe not found");
  if (iframeSrc.startsWith("//")) iframeSrc = `https:${iframeSrc}`;

  const iframeHtml = await fetchText(iframeSrc, { referer: link });
  const prorcpMatch = iframeHtml.match(/src:\s*'(\/prorcp\/[^']+)'/);
  if (!prorcpMatch) throw new Error("Vidsrc.net: prorcp not found");
  const prorcp = iframeSrc.replace(/\/rcp.*$/, "") + prorcpMatch[1];

  const script = await fetchText(prorcp, { referer: iframeSrc });
  const playerId = script.match(/Playerjs.*file:\s*([a-zA-Z0-9]+)\s*,/)?.[1];
  let streamUrl: string | undefined;

  if (playerId) {
    const encMatch = script.match(
      new RegExp(`<div id="${playerId}" style="display:none;">\\s*([^<]+)\\s*</div>`)
    );
    if (encMatch) streamUrl = decrypt(playerId, encMatch[1].trim());
  } else {
    streamUrl = script.match(/Playerjs.*file:\s*"([^"]+)"/)?.[1];
  }

  if (!streamUrl) throw new Error("Vidsrc.net: no stream");
  streamUrl = streamUrl.split(" or ")[0].replace(/\{[a-z]\d+\}/g, "quibblezoomfable.com");

  return {
    source: streamUrl,
    subtitles: parseSubtitles(script, iframeSrc),
    headers: { Referer: iframeSrc },
    type: streamUrl.includes(".m3u8") ? ("m3u8" as const) : undefined,
  };
}

export const vidsrcNetExtractor: ExtractorDef = {
  name: "Vidsrc.net",
  mainUrl: MAIN_URL,
  aliasUrls: ["https://vsembed.ru"],
  extract: (link) => extractVidsrcNet(link),
};

/** Exported for unit tests */
export const vidsrcNetDecrypt = decrypt;
