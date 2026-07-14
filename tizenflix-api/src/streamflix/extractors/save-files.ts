import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from SaveFilesExtractor (GenericPackedSourceExtractor) */
export const saveFilesExtractor: ExtractorDef = {
  name: "Savefiles",
  mainUrl: "https://savefiles.com/",
  aliasUrls: ["https://streamhls.to"],
  extract: (link) => extractGenericPacked(link),
};
