import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from VidHideExtractor — fallback generic packed */
export const vidHideExtractor: ExtractorDef = {
  name: "VidHide",
  mainUrl: "https://dhtpre.com",
  aliasUrls: ["https://peytonepre.com", "https://vidhideplus.com/", "https://mivalyo", "https://dinisglows", "https://dingtezuni.com", "https://dintezuvio.com", "https://minochinos.com", "https://moflix-stream.click", "https://filelions.to"],
  extract: (link) => extractGenericPacked(link),
};
