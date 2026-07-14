import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from LamovieExtractor (GenericPackedSourceExtractor) */
export const lamovieExtractor: ExtractorDef = {
  name: "Lamovie",
  mainUrl: "https://lamovie.link",
  aliasUrls: ["https://vimeos.net"],
  extract: (link) => extractGenericPacked(link),
};
