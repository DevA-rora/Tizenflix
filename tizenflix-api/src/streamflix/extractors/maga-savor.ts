import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from MagaSavorExtractor (GenericPackedSourceExtractor) */
export const magaSavorExtractor: ExtractorDef = {
  name: "MagaSavors",
  mainUrl: "https://magasavor.net",
  extract: (link) => extractGenericPacked(link),
};
