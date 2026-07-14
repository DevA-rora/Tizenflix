import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from UpzoneExtractor — fallback generic packed */
export const upzoneExtractor: ExtractorDef = {
  name: "Upzone",
  mainUrl: "https://upzone.cc",
  aliasUrls: ["https://upzone.to", "https://upzone.net", "https://upzone.link"],
  extract: (link) => extractGenericPacked(link),
};
