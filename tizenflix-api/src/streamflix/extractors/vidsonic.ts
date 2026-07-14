import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidsonicExtractor — fallback generic packed */
export const vidsonicExtractor: ExtractorDef = {
  name: "Vidsonic",
  mainUrl: "https://vidsonic.net",
  extract: (link) => extractGenericPacked(link),
};
