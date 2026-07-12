import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from OneuploadExtractor */
export const oneuploadExtractor: ExtractorDef = {
  name: "OneUpload",
  mainUrl: "https://oneupload.net",
  aliasUrls: ["https://tipfly.xyz"],
  extract: notImplementedExtract("OneUpload"),
};
