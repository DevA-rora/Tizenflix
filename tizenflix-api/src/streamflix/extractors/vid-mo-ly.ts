import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from VidMoLyExtractor */
export const vidMoLyExtractor: ExtractorDef = {
  name: "VidMoLy",
  mainUrl: "https://vidmoly.me/",
  aliasUrls: ["https://vidmoly.net"],
  extract: notImplementedExtract("VidMoLy"),
};
