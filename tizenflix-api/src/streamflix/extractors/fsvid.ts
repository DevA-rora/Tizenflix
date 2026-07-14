import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from FsvidExtractor (GenericPackedSourceExtractor) */
export const fsvidExtractor: ExtractorDef = {
  name: "FSVid",
  mainUrl: "https://fsvid.lol",
  extract: (link) => extractGenericPacked(link),
};
