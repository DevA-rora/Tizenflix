import type { ExtractorDef } from "../types.js";
import { extractStreamWishPacked } from "./base/streamwish-family.js";

export const streamWishExtractor: ExtractorDef = {
  name: "Streamwish",
  mainUrl: "https://streamwish.to",
  aliasUrls: [
    "https://streamwish.com",
    "https://embedwish.com",
    "https://uqloads.xyz",
    "https://wishembed.pro",
    "https://strmwis.xyz",
    "https://awish.pro",
    "https://dwish.pro",
    "https://cdnwish.com",
    "https://flaswish.com",
    "https://obeywish.com",
    "https://jodwish.com",
    "https://strwish.com",
    "https://asnwish.com",
  ],
  extract: (link, _server) => extractStreamWishPacked(link),
};
