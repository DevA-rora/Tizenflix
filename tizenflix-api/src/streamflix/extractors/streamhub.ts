import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from StreamhubExtractor (GenericPackedSourceExtractor) */
export const streamhubExtractor: ExtractorDef = {
  name: "Streamhub",
  mainUrl: "https://streamhub.to",
  extract: (link) => extractGenericPacked(link),
};
