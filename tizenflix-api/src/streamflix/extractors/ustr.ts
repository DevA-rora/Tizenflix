import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from USTRExtractor — fallback generic packed */
export const ustrExtractor: ExtractorDef = {
  name: "USTR",
  mainUrl: "https://ups2up.fun",
  aliasUrls: ["https://up4stream.com", "https://up4fun.top"],
  extract: (link) => extractGenericPacked(link),
};
