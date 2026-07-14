import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VtubeExtractor (GenericPackedSourceExtractor) */
export const vtubeExtractor: ExtractorDef = {
  name: "Vtube",
  mainUrl: "https://vtbe.to",
  aliasUrls: ["https://vtube.to"],
  extract: (link) => extractGenericPacked(link),
};
