import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from StreamUpExtractor (GenericPackedSourceExtractor) */
export const streamUpExtractor: ExtractorDef = {
  name: "StreamUp",
  mainUrl: "https://strmup.to",
  extract: (link) => extractGenericPacked(link),
};
