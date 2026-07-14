import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidnestExtractor — fallback generic packed */
export const vidnestExtractor: ExtractorDef = {
  name: "Vidnest",
  mainUrl: "https://vidnest.io",
  extract: (link) => extractGenericPacked(link),
};
