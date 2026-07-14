import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from MyFileStorageExtractor (GenericPackedSourceExtractor) */
export const myFileStorageExtractor: ExtractorDef = {
  name: "MyFileStorage",
  mainUrl: "https://myfilestorage.xyz",
  extract: (link) => extractGenericPacked(link),
};
