import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from LamovieExtractor */
export const lamovieExtractor: ExtractorDef = {
  name: "Lamovie",
  mainUrl: "https://lamovie.link",
  aliasUrls: ["https://vimeos.net"],
  extract: notImplementedExtract("Lamovie"),
};
