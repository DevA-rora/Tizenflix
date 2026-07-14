import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from UpZurExtractor — fallback generic packed */
export const upZurExtractor: ExtractorDef = {
  name: "UpZur",
  mainUrl: "https://upzur.com",
  extract: (link) => extractGenericPacked(link),
};
