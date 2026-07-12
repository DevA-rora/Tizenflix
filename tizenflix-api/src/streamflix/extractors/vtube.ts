import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from VtubeExtractor */
export const vtubeExtractor: ExtractorDef = {
  name: "Vtube",
  mainUrl: "https://vtbe.to",
  aliasUrls: ["https://vtube.to"],
  extract: notImplementedExtract("Vtube"),
};
