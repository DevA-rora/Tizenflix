import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from VeevExtractor */
export const veevExtractor: ExtractorDef = {
  name: "Veev",
  mainUrl: "https://veev.to",
  aliasUrls: ["https://veev.to", "https://kinoger.pw", "https://poophq.com", "https://doods.to"],
  extract: notImplementedExtract("Veev"),
};
