import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

export const chillxJeanExtractor: ExtractorDef = {
  name: "Chillx Jean",
  mainUrl: "https://jeanflix.top",
  extract: (link) => extractGenericPacked(link),
};
