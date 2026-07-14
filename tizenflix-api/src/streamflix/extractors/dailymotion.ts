import type { ExtractorDef } from "../types.js";
import { extractDailymotion } from "./base/embed-hosts.js";

export const dailymotionExtractor: ExtractorDef = {
  name: "Dailymotion",
  mainUrl: "https://www.dailymotion.com",
  extract: extractDailymotion,
};
