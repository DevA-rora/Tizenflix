import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from StreamixExtractor */
export const streamixExtractor: ExtractorDef = {
  name: "Streamix",
  mainUrl: "https://streamix.so",
  aliasUrls: ["https://stmix.io"],
  extract: notImplementedExtract("Streamix"),
};
