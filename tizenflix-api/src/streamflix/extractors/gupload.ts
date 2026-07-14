import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from GuploadExtractor — fallback generic packed */
export const guploadExtractor: ExtractorDef = {
  name: "Gupload",
  mainUrl: "https://gupload.xyz",
  extract: (link) => extractGenericPacked(link),
};
