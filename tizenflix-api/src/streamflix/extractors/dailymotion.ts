import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from DailymotionExtractor */
export const dailymotionExtractor: ExtractorDef = {
  name: "Dailymotion",
  mainUrl: "https://www.dailymotion.com",
  aliasUrls: ["https://geo.dailymotion.com"],
  extract: notImplementedExtract("Dailymotion"),
};
