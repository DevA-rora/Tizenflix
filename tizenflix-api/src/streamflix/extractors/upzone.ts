import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from UpzoneExtractor */
export const upzoneExtractor: ExtractorDef = {
  name: "Upzone",
  mainUrl: "https://upzone.cc",
  aliasUrls: ["https://upzone.to", "https://upzone.net", "https://upzone.link"],
  extract: notImplementedExtract("Upzone"),
};
