import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from OneuploadExtractor (GenericPackedSourceExtractor) */
export const oneuploadExtractor: ExtractorDef = {
  name: "OneUpload",
  mainUrl: "https://oneupload.net",
  aliasUrls: ["https://tipfly.xyz"],
  extract: (link) => extractGenericPacked(link),
};
