import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from ApiVoirFilmExtractor */
export const apiVoirFilmExtractor: ExtractorDef = {
  name: "ApiVoirFilm",
  mainUrl: "https://api.voirfilm.cam",
  aliasUrls: ["https://api.voirfilm."],
  extract: notImplementedExtract("ApiVoirFilm"),
};
