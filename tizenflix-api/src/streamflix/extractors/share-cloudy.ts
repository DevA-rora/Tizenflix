import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from ShareCloudyExtractor (GenericPackedSourceExtractor) */
export const shareCloudyExtractor: ExtractorDef = {
  name: "ShareCloudy",
  mainUrl: "https://sharecloudy.com",
  extract: (link) => extractGenericPacked(link),
};
