import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from ZillaExtractor (GenericPackedSourceExtractor) */
export const zillaExtractor: ExtractorDef = {
  name: "Zilla",
  mainUrl: "https://player.zilla-networks.com",
  extract: (link) => extractGenericPacked(link),
};
