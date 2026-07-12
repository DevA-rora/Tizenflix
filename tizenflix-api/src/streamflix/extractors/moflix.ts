import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from MoflixExtractor */
export const moflixExtractor: ExtractorDef = {
  name: "Moflix",
  mainUrl: "https://example.com",
  aliasUrls: ["https://moflix-stream.xyz"],
  extract: notImplementedExtract("Moflix"),
};
