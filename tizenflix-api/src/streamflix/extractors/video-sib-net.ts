import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VideoSibNetExtractor — fallback generic packed */
export const videoSibNetExtractor: ExtractorDef = {
  name: "VideoSibNet",
  mainUrl: "https://example.com",
  extract: (link) => extractGenericPacked(link),
};
