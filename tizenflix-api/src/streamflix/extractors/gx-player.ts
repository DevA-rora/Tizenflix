import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from GxPlayerExtractor — fallback generic packed */
export const gxPlayerExtractor: ExtractorDef = {
  name: "GxPlayer",
  mainUrl: "https://watch.gxplayer.xyz",
  extract: (link) => extractGenericPacked(link),
};
