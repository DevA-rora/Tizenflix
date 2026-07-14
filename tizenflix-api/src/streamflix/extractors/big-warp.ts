import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from BigWarpExtractor (GenericPackedSourceExtractor) */
export const bigWarpExtractor: ExtractorDef = {
  name: "BigWarp (VLC only)",
  mainUrl: "https://bigwarp.cc/",
  aliasUrls: ["https://bigwarp.io", "https://bigwarp.pro"],
  extract: (link) => extractGenericPacked(link),
};
