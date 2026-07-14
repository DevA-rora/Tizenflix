import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from RidooExtractor (GenericPackedSourceExtractor) */
export const ridooExtractor: ExtractorDef = {
  name: "Ridoo",
  mainUrl: "https://ridoo.net",
  extract: (link) => extractGenericPacked(link),
};
