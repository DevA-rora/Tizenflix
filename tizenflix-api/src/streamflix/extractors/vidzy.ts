import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidzyExtractor — fallback generic packed */
export const vidzyExtractor: ExtractorDef = {
  name: "Vidzy",
  mainUrl: "https://vidzy.org",
  extract: (link) => extractGenericPacked(link),
};
