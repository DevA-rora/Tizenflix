import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from StreamSBExtractor (GenericPackedSourceExtractor) */
export const streamSbExtractor: ExtractorDef = {
  name: "StreamSB",
  mainUrl: "https://example.com",
  extract: (link) => extractGenericPacked(link),
};
