import * as cheerio from "cheerio";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { extractStreamWishPacked } from "./base/streamwish-family.js";

async function extractTwoEmbed(link: string) {
  const html = await fetchText(link);
  const $ = cheerio.load(html);
  const iframeSrc = $("iframe").attr("data-src") ?? $("iframe").attr("src");
  if (!iframeSrc) throw new Error("2Embed: iframe not found");

  const id = iframeSrc.split("id=")[1]?.split("&")[0];
  if (!id) throw new Error("2Embed: embed id missing");

  const uqUrl = `https://uqloads.xyz/e/${id}`;
  const referer = iframeSrc.startsWith("http")
    ? new URL(iframeSrc).origin
    : "https://www.2embed.cc";

  return extractStreamWishPacked(uqUrl, referer);
}

export const twoEmbedExtractor: ExtractorDef = {
  name: "2Embed",
  mainUrl: "https://www.2embed.cc",
  extract: extractTwoEmbed,
};
