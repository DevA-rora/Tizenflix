import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from HxfileExtractor (GenericPackedSourceExtractor) */
export const hxfileExtractor: ExtractorDef = {
  name: "Hxfile",
  mainUrl: "https://hxfile.co",
  extract: (link) => extractGenericPacked(link),
};
