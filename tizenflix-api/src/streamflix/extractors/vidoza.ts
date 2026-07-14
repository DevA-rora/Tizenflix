import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidozaExtractor — fallback generic packed */
export const vidozaExtractor: ExtractorDef = {
  name: "Vidoza",
  mainUrl: "https://vidoza.net",
  extract: (link) => extractGenericPacked(link),
};
