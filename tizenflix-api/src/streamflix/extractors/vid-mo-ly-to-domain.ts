import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidMoLyExtractor.ToDomain — fallback generic packed */
export const vidMoLyToDomainExtractor: ExtractorDef = {
  name: "VidMoLy",
  mainUrl: "https://vidmoly.me/",
  aliasUrls: ["https://vidmoly.net"],
  extract: (link) => extractGenericPacked(link),
};
