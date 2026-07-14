import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from YourUploadExtractor (GenericPackedSourceExtractor) */
export const yourUploadExtractor: ExtractorDef = {
  name: "YourUpload",
  mainUrl: "https://www.yourupload.com",
  aliasUrls: ["https://www.yucache.net"],
  extract: (link) => extractGenericPacked(link),
};
