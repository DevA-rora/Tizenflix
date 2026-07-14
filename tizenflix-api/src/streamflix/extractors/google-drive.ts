import type { ExtractorDef } from "../types.js";
import { extractGoogleDrive } from "./base/embed-hosts.js";

export const googleDriveExtractor: ExtractorDef = {
  name: "Google Drive",
  mainUrl: "https://drive.google.com",
  extract: extractGoogleDrive,
};
