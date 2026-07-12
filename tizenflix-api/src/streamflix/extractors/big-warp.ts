import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from BigWarpExtractor */
export const bigWarpExtractor: ExtractorDef = {
  name: "BigWarp (VLC only)",
  mainUrl: "https://bigwarp.cc/",
  aliasUrls: ["https://bigwarp.io", "https://bigwarp.pro"],
  extract: notImplementedExtract("BigWarp (VLC only)"),
};
