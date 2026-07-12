import type { ExtractorDef } from "../types.js";
import { extractDoodStream } from "./base/dood-family.js";

export const doodLaExtractor: ExtractorDef = {
  name: "DoodStream",
  mainUrl: "https://dood.la",
  aliasUrls: [
    "https://dsvplay.com",
    "https://myvidplay.com",
    "https://playmogo.com",
    "https://do7go.com",
    "https://d000d.com",
    "https://vide0.net",
    "https://dood.li",
  ],
  extract: extractDoodStream,
};
