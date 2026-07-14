import type { ExtractorDef } from "../types.js";
import { extractOkru } from "./base/embed-hosts.js";

export const okruExtractor: ExtractorDef = {
  name: "Okru",
  mainUrl: "https://ok.ru",
  extract: extractOkru,
};
