import type { ExtractorDef } from "../types.js";
import { extractUqload } from "./base/embed-hosts.js";

export const uqloadExtractor: ExtractorDef = {
  name: "Uqload",
  mainUrl: "https://uqload.cx",
  aliasUrls: ["https://uqload.is"],
  extract: extractUqload,
};
