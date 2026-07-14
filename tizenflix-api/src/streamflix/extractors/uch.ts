import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from UchExtractor (GenericPackedSourceExtractor) */
export const uchExtractor: ExtractorDef = {
  name: "Uch",
  mainUrl: "https://example.com",
  extract: (link) => extractGenericPacked(link),
};
