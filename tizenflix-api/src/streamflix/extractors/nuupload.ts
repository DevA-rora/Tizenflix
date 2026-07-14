import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from NuuploadExtractor (GenericPackedSourceExtractor) */
export const nuuploadExtractor: ExtractorDef = {
  name: "Nuupload",
  mainUrl: "https://nupload.top/",
  aliasUrls: ["https://nupupload.top/", "https://nupload.top", "https://ap.nupload.me/", "https://nupload.me/"],
  extract: (link) => extractGenericPacked(link),
};
