import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from StreamrubyExtractor (GenericPackedSourceExtractor) */
export const streamrubyExtractor: ExtractorDef = {
  name: "Streamruby",
  mainUrl: "https://streamruby.com",
  aliasUrls: ["https://stmruby.com", "https://rubystm.com", "https://rubyvid.com", "https://moflix-stream.fans"],
  extract: (link) => extractGenericPacked(link),
};
