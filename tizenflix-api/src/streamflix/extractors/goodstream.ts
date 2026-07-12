import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

export const goodstreamExtractor: ExtractorDef = {
  name: "Goodstream",
  mainUrl: "https://goodstream.one",
  extract: (link) => extractGenericPacked(link),
};
