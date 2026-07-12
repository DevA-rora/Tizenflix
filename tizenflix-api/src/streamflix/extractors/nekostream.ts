import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

export const nekostreamExtractor: ExtractorDef = {
  name: "Nekostream",
  mainUrl: "https://nekostream.io",
  extract: (link) => extractGenericPacked(link),
};
