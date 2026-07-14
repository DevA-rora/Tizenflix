import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from StreamlareExtractor (GenericPackedSourceExtractor) */
export const streamlareExtractor: ExtractorDef = {
  name: "Streamlare",
  mainUrl: "https://example.com",
  extract: (link) => extractGenericPacked(link),
};
