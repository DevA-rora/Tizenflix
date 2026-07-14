import type { ExtractorDef } from "../types.js";
import { extractSupervideo } from "./base/embed-hosts.js";

export const supervideoExtractor: ExtractorDef = {
  name: "Supervideo",
  mainUrl: "https://supervideo.cc",
  extract: extractSupervideo,
};
