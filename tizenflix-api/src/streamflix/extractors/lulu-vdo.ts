import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from LuluVdoExtractor — fallback generic packed */
export const luluVdoExtractor: ExtractorDef = {
  name: "LuluVdo",
  mainUrl: "https://luluvdo.com/",
  aliasUrls: ["https://luluvdoo.com", "https://luluvid.com"],
  extract: (link) => extractGenericPacked(link),
};
