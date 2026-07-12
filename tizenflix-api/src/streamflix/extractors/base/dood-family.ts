import type { ExtractedVideo } from "../../types.js";
import { fetchText } from "../../http.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomSuffix(): string {
  return Array.from({ length: 10 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
}

function baseUrl(link: string): string {
  const u = new URL(link);
  return `${u.protocol}//${u.host}`;
}

export async function extractDoodStream(link: string): Promise<ExtractedVideo> {
  const embed = link.replace("/d/", "/e/");
  const html = await fetchText(embed, { referer: link });
  const md5Path = html.match(/\/pass_md5\/[^']*/)?.[0];
  if (!md5Path) throw new Error("DoodStream: pass_md5 path not found");

  const host = baseUrl(embed);
  const prefix = await fetchText(`${host}${md5Path}`, { referer: embed });
  const token = md5Path.split("/").pop() ?? "";
  const url = `${prefix}${randomSuffix()}?token=${token}`;

  return {
    source: url,
    subtitles: [],
    headers: { Referer: host },
  };
}
