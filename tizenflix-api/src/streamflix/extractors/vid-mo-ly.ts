import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidMoLyExtractor — fallback generic packed */
export const vidMoLyExtractor: ExtractorDef = {
  name: "VidMoLy",
  mainUrl: "https://vidmoly.me/",
  aliasUrls: ["https://vidmoly.net"],
  extract: (link) => extractGenericPacked(link),
};
