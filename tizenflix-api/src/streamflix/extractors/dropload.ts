import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from DroploadExtractor (GenericPackedSourceExtractor) */
export const droploadExtractor: ExtractorDef = {
  name: "Dropload",
  mainUrl: "https://dropload.tv",
  aliasUrls: ["https://dropload.io", "https://dropload.pro", "https://dr0pstream.com"],
  extract: (link) => extractGenericPacked(link),
};
