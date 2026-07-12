import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from VidaraExtractor */
export const vidaraExtractor: ExtractorDef = {
  name: "Vidara",
  mainUrl: "https://vidara.to",
  aliasUrls: ["https://vidara.so"],
  extract: notImplementedExtract("Vidara"),
};
