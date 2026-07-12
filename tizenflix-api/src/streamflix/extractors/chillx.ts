import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

export const chillxExtractor: ExtractorDef = {
  name: "Chillx",
  mainUrl: "https://chillx.top",
  aliasUrls: ["https://chillx.cc", "https://chillx.biz"],
  extract: (link) => extractGenericPacked(link),
};
