import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidaraExtractor — fallback generic packed */
export const vidaraExtractor: ExtractorDef = {
  name: "Vidara",
  mainUrl: "https://vidara.to",
  aliasUrls: ["https://vidara.so"],
  extract: (link) => extractGenericPacked(link),
};
