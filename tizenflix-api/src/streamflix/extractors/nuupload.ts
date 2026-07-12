import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from NuuploadExtractor */
export const nuuploadExtractor: ExtractorDef = {
  name: "Nuupload",
  mainUrl: "https://nupload.top/",
  aliasUrls: ["https://nupupload.top/", "https://nupload.top", "https://ap.nupload.me/", "https://nupload.me/"],
  extract: notImplementedExtract("Nuupload"),
};
