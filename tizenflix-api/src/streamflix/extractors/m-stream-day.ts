import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from MStreamDayExtractor (GenericPackedSourceExtractor) */
export const mStreamDayExtractor: ExtractorDef = {
  name: "MStreamDay",
  mainUrl: "https://example.com",
  extract: (link) => extractGenericPacked(link),
};
