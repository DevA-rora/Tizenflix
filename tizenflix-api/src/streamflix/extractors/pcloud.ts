import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from PcloudExtractor — fallback generic packed */
export const pcloudExtractor: ExtractorDef = {
  name: "Pcloud",
  mainUrl: "https://u.pcloud.link",
  extract: (link) => extractGenericPacked(link),
};
