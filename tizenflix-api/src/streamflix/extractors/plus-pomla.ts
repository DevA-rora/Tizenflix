import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from PlusPomlaExtractor (GenericPackedSourceExtractor) */
export const plusPomlaExtractor: ExtractorDef = {
  name: "PlusPomla",
  mainUrl: "https://apu.animemovil2.com",
  extract: (link) => extractGenericPacked(link),
};
