import type { ExtractorDef } from "../types.js";
import { extractAmazonDrive } from "./base/embed-hosts.js";

export const amazonDriveExtractor: ExtractorDef = {
  name: "Amazon Drive",
  mainUrl: "https://www.amazon.com",
  extract: extractAmazonDrive,
};
