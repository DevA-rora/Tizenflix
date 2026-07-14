import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from MaxstreamExtractor (GenericPackedSourceExtractor) */
export const maxstreamExtractor: ExtractorDef = {
  name: "Maxstream",
  mainUrl: "https://maxstream.video",
  extract: (link) => extractGenericPacked(link),
};
