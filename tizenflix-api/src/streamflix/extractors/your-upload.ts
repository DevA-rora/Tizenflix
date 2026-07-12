import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from YourUploadExtractor */
export const yourUploadExtractor: ExtractorDef = {
  name: "YourUpload",
  mainUrl: "https://www.yourupload.com",
  aliasUrls: ["https://www.yucache.net"],
  extract: notImplementedExtract("YourUpload"),
};
