import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidxGoExtractor — fallback generic packed */
export const vidxGoExtractor: ExtractorDef = {
  name: "VidxGo",
  mainUrl: "https://v.vidxgo.co",
  extract: (link) => extractGenericPacked(link),
};
