import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from StreamixExtractor (GenericPackedSourceExtractor) */
export const streamixExtractor: ExtractorDef = {
  name: "Streamix",
  mainUrl: "https://streamix.so",
  aliasUrls: ["https://stmix.io"],
  extract: (link) => extractGenericPacked(link),
};
