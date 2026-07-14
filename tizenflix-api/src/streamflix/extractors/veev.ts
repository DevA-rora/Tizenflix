import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VeevExtractor — fallback generic packed */
export const veevExtractor: ExtractorDef = {
  name: "Veev",
  mainUrl: "https://veev.to",
  aliasUrls: ["https://veev.to", "https://kinoger.pw", "https://poophq.com", "https://doods.to"],
  extract: (link) => extractGenericPacked(link),
};
