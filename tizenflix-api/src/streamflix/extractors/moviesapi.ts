import * as cheerio from "cheerio";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { extractGenericPacked } from "./base/generic-packed.js";

const MAIN_URL = "https://moviesapi.club";

async function extractMoviesapi(link: string) {
  const html = await fetchText(link, { referer: "https://pressplay.top/" });
  const $ = cheerio.load(html);
  const iframe = $("iframe").attr("src");
  if (!iframe) throw new Error("Moviesapi: iframe not found");
  const iframeUrl = iframe.startsWith("http") ? iframe : `https:${iframe}`;
  return extractGenericPacked(iframeUrl, link);
}

export const moviesapiExtractor: ExtractorDef = {
  name: "Moviesapi",
  mainUrl: MAIN_URL,
  extract: (link) => extractMoviesapi(link),
};
