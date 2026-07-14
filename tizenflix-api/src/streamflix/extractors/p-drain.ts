import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from PDrainExtractor — fallback generic packed */
export const pDrainExtractor: ExtractorDef = {
  name: "PDrain",
  mainUrl: "https://pixeldrain.com",
  extract: (link) => extractGenericPacked(link),
};
