import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from ApiVoirFilmExtractor (GenericPackedSourceExtractor) */
export const apiVoirFilmExtractor: ExtractorDef = {
  name: "ApiVoirFilm",
  mainUrl: "https://api.voirfilm.cam",
  aliasUrls: ["https://api.voirfilm."],
  extract: (link) => extractGenericPacked(link),
};
