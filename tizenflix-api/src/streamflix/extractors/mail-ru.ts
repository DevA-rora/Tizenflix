import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from MailRuExtractor — fallback generic packed */
export const mailRuExtractor: ExtractorDef = {
  name: "MailRu",
  mainUrl: "https://my.mail.ru",
  extract: (link) => extractGenericPacked(link),
};
