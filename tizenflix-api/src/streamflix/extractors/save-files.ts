import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from SaveFilesExtractor */
export const saveFilesExtractor: ExtractorDef = {
  name: "Savefiles",
  mainUrl: "https://savefiles.com/",
  aliasUrls: ["https://streamhls.to"],
  extract: notImplementedExtract("Savefiles"),
};
