import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from NinjaStreamExtractor (GenericPackedSourceExtractor) */
export const ninjaStreamExtractor: ExtractorDef = {
  name: "NinjaStream",
  mainUrl: "https://example.com",
  extract: (link) => extractGenericPacked(link),
};
