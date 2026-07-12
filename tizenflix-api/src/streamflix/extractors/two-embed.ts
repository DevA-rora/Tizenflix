import * as cheerio from "cheerio";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { extractStreamWishPacked } from "./base/streamwish-family.js";
import { interceptEmbedRequest } from "./base/playwright-embed.js";

function resolveIframeSrc(html: string): string | null {
  const $ = cheerio.load(html);
  const candidates = [
    $("iframe[data-src]").attr("data-src"),
    $("iframe#player_iframe").attr("src"),
    $("iframe").attr("data-src"),
    $("iframe").attr("src"),
  ].filter(Boolean) as string[];

  if (candidates.length) return candidates[0]!;

  const match = html.match(/<iframe[^>]+(?:data-src|src)=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function parseEmbedId(iframeSrc: string): string {
  try {
    const abs = iframeSrc.startsWith("//")
      ? `https:${iframeSrc}`
      : iframeSrc.startsWith("http")
        ? iframeSrc
        : `https://www.2embed.cc${iframeSrc.startsWith("/") ? "" : "/"}${iframeSrc}`;
    const url = new URL(abs);
    const id = url.searchParams.get("id");
    if (id) return id;
  } catch {
    /* fall through */
  }
  const fromQuery = iframeSrc.split("id=")[1]?.split("&")[0];
  if (fromQuery) return fromQuery;
  throw new Error("2Embed: embed id missing");
}

function resolveStreamHost(iframeSrc: string): string {
  try {
    const abs = iframeSrc.startsWith("//")
      ? `https:${iframeSrc}`
      : iframeSrc.startsWith("http")
        ? iframeSrc
        : `https://www.2embed.cc${iframeSrc}`;
    return new URL(abs).origin;
  } catch {
    return "https://uqloads.xyz";
  }
}

async function extractTwoEmbed(link: string) {
  try {
    const html = await fetchText(link, { timeoutMs: 20_000 });
    const iframeSrc = resolveIframeSrc(html);
    if (!iframeSrc) throw new Error("2Embed: iframe not found");

    const id = parseEmbedId(iframeSrc);
    const host = resolveStreamHost(iframeSrc);
    const streamUrl = `${host}/e/${id}`;
    const referer = iframeSrc.startsWith("http")
      ? new URL(iframeSrc).origin + "/"
      : iframeSrc.startsWith("//")
        ? `https:${iframeSrc}`.replace(/\/[^/]*$/, "/")
        : "https://www.2embed.cc/";

    return extractStreamWishPacked(streamUrl, referer, host);
  } catch (err) {
    const hit = await interceptEmbedRequest(link, [{ pattern: /\.m3u8/i, type: "m3u8" }], 45_000);
    return {
      source: hit.url,
      subtitles: [],
      headers: { Referer: "https://www.2embed.cc/" },
      type: "m3u8" as const,
    };
  }
}

export const twoEmbedExtractor: ExtractorDef = {
  name: "2Embed",
  mainUrl: "https://www.2embed.cc",
  extract: (link) => extractTwoEmbed(link),
};
