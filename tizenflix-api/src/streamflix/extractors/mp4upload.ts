import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from Mp4UploadExtractor (GenericPackedSourceExtractor) */
export const mp4uploadExtractor: ExtractorDef = {
  name: "Mp4Upload",
  mainUrl: "https://example.com",
  extract: (link) => extractGenericPacked(link),
};
