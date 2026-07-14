import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidPlyExtractor — fallback generic packed */
export const vidPlyExtractor: ExtractorDef = {
  name: "VidPly",
  mainUrl: "https://vidply.com/",
  extract: (link) => extractGenericPacked(link),
};
