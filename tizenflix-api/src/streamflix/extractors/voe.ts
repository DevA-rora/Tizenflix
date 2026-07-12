import type { ExtractedVideo } from "../types.js";
import { BROWSER_UA, fetchText } from "../http.js";
import { decryptVoe, findVoeEncodedJson } from "./voe-decrypt.js";

const MAIN_URL = "https://voe.sx/";
const ALIAS_URLS = [
  "https://jilliandescribecompany.com",
  "https://mikaylaarealike.com",
  "https://christopheruntilpoint.com",
];

export const voeExtractor = {
  name: "VOE",
  mainUrl: MAIN_URL,
  aliasUrls: ALIAS_URLS,
  async extract(link: string): Promise<ExtractedVideo> {
    const parsed = new URL(link);
    const path = parsed.pathname + (parsed.search || "");

    const initialHtml = await fetchText(link, {
      headers: { Referer: link },
    });

    const redirectMatch = initialHtml.match(/https:\/\/([a-zA-Z0-9.-]+)(?:\/[^'"]*)?/);
    const redirectBase = redirectMatch ? `https://${redirectMatch[1]}/` : MAIN_URL;

    const html = redirectBase !== MAIN_URL ? await fetchText(redirectBase + path.replace(/^\//, ""), {
      headers: { Referer: link },
    }) : initialHtml;

    const scriptTag = html.match(/<script\s+type="application\/json">(.*?)<\/script>/s);
    const encodedFromScript = scriptTag?.[1]?.trim();
    const encodedFromRegex = findVoeEncodedJson(html);
    const encoded = encodedFromRegex ?? encodedFromScript;
    if (!encoded) throw new Error("VOE: no encoded payload found");

    const decrypted = decryptVoe(encoded);
    const source = String(decrypted.source ?? "");
    if (!source) throw new Error("VOE: no source in decrypted payload");

    let baseSubtitle = "";
    const baseMatch = html.match(/var\s+base\s*=\s*['"]([^'"]+)['"]/);
    if (baseMatch) baseSubtitle = baseMatch[1];

    const captions = Array.isArray(decrypted.captions) ? decrypted.captions : [];
    const subtitles = captions.map((cap: Record<string, unknown>) => {
      let file = String(cap.file ?? "");
      if (file && !file.startsWith("http")) file = baseSubtitle + file;
      return {
        label: String(cap.label ?? "Unknown"),
        file,
        default: Boolean(cap.default),
      };
    });

    return {
      source,
      subtitles,
      headers: { Referer: link, "User-Agent": BROWSER_UA },
    };
  },
};
