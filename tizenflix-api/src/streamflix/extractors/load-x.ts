import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from LoadXExtractor (GenericPackedSourceExtractor) */
export const loadXExtractor: ExtractorDef = {
  name: "LoadX",
  mainUrl: "https://loadx.ws/",
  extract: (link) => extractGenericPacked(link),
};
