import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

export const onRegardeOuExtractor: ExtractorDef = {
  name: "OnRegardeOu",
  mainUrl: "https://onregardeou.fr",
  extract: (link) => extractGenericPacked(link),
};
