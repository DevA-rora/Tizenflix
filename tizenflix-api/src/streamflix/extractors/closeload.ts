import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

export const closeloadExtractor: ExtractorDef = {
  name: "Closeload",
  mainUrl: "https://closeload.top",
  extract: (link) => extractGenericPacked(link),
};
