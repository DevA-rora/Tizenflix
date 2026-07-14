import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidoraExtractor — fallback generic packed */
export const vidoraExtractor: ExtractorDef = {
  name: "Vidora",
  mainUrl: "https://vidora.stream",
  extract: (link) => extractGenericPacked(link),
};
