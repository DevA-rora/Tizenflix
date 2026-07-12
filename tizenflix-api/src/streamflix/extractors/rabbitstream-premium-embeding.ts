import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from RabbitstreamExtractor.PremiumEmbedingExtractor */
export const rabbitstreamPremiumEmbedingExtractor: ExtractorDef = {
  name: "Rabbitstream",
  mainUrl: "https://rabbitstream.net",
  aliasUrls: ["https://videostr.net"],
  extract: notImplementedExtract("Rabbitstream"),
};
