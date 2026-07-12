import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from DroploadExtractor */
export const droploadExtractor: ExtractorDef = {
  name: "Dropload",
  mainUrl: "https://dropload.tv",
  aliasUrls: ["https://dropload.io", "https://dropload.pro", "https://dr0pstream.com"],
  extract: notImplementedExtract("Dropload"),
};
