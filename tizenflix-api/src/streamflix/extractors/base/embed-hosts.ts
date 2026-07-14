import type { ExtractedVideo } from "../../types.js";
import { fetchText } from "../../http.js";
import { unpackJs } from "../../network/js-unpacker.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function extractUqload(link: string): Promise<ExtractedVideo> {
  const baseUrl = new URL(link).origin;
  const html = await fetchText(link, { headers: { "User-Agent": UA } });
  const script = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?(?=<\/script>)/i)?.[0];
  if (!script) throw new Error("Uqload: packed script not found");
  const unpacked = unpackJs(script) ?? "";
  const sourceUrl = unpacked.match(/file\s*:\s*["']([^"']+)["']/)?.[1];
  if (!sourceUrl) throw new Error("Uqload: source not found");
  return {
    source: sourceUrl,
    subtitles: [],
    headers: { Referer: baseUrl, "User-Agent": UA },
  };
}

export async function extractSupervideo(link: string): Promise<ExtractedVideo> {
  const url = link.startsWith("http") ? link : `https:${link}`;
  const html = await fetchText(url, { headers: { "User-Agent": UA } });
  const script = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?(?=<\/script>)/i)?.[0];
  if (!script) throw new Error("Supervideo: packed script not found");
  const unpacked = unpackJs(script) ?? "";
  const streamUrl = unpacked.match(/file\s*:\s*["']([^"']+)["']/)?.[1];
  if (!streamUrl) throw new Error("Supervideo: stream URL not found");

  const tracksBlock = unpacked.match(/tracks\s*:\s*\[(.*?)\]/s)?.[1] ?? "";
  const subtitles: ExtractedVideo["subtitles"] = [];
  const capRe = /file\s*:\s*"(.*?)"\s*,\s*label\s*:\s*"(.*?)"\s*,\s*kind\s*:\s*"captions"/g;
  let m: RegExpExecArray | null;
  while ((m = capRe.exec(tracksBlock)) !== null) {
    subtitles.push({ file: m[1]!, label: m[2]! });
  }

  return {
    source: streamUrl,
    subtitles,
    headers: { Referer: "https://supervideo.cc/", "User-Agent": UA },
  };
}

export async function extractOkru(link: string): Promise<ExtractedVideo> {
  const html = await fetchText(link, { headers: { "User-Agent": UA } });
  const opts = html.match(/data-options="([^"]+)"/)?.[1];
  if (!opts) throw new Error("Okru: data-options not found");
  const decoded = opts.replace(/&quot;/g, '"').replace(/\\u0026/g, "&");
  const videos: Array<{ quality: string; url: string }> = [];
  const urlRe = /"url":"([^"]+)"/g;
  const nameRe = /"name":"([^"]+)"/g;
  const urls = [...decoded.matchAll(urlRe)].map((x) => x[1]!.replace(/\\u0026/g, "&"));
  const names = [...decoded.matchAll(nameRe)].map((x) => x[1]!);
  for (let i = 0; i < urls.length; i++) {
    if (urls[i]?.startsWith("https://")) videos.push({ quality: names[i] ?? "", url: urls[i]! });
  }
  if (!videos.length) throw new Error("Okru: no videos found");
  return {
    source: videos[0]!.url,
    subtitles: [],
    headers: { Referer: "https://ok.ru/", "User-Agent": UA },
  };
}

export async function extractDailymotion(link: string): Promise<ExtractedVideo> {
  const html = await fetchText(link, { headers: { "User-Agent": UA } });
  const meta = html.match(/"qualities":\{[^}]+\}/)?.[0];
  const hls = html.match(/"(https:\/\/[^"]+\.m3u8[^"]*)"/)?.[1];
  if (hls) {
    return { source: hls, subtitles: [], headers: { Referer: link, "User-Agent": UA }, type: "m3u8" };
  }
  if (meta) throw new Error("Dailymotion: parse qualities manually");
  throw new Error("Dailymotion: source not found");
}

export async function extractGoogleDrive(link: string): Promise<ExtractedVideo> {
  const html = await fetchText(link, { headers: { "User-Agent": UA } });
  const src =
    html.match(/"([^"]+\/videoplayback[^"]+)"/)?.[1]?.replace(/\\u003d/g, "=") ??
    html.match(/https:\/\/[^"]+\.googlevideo\.com[^"]+/)?.[0];
  if (!src) throw new Error("Google Drive: source not found");
  const source = src.startsWith("http") ? src : `https://drive.google.com${src}`;
  return { source, subtitles: [], headers: { Referer: link, "User-Agent": UA } };
}

export async function extractAmazonDrive(link: string): Promise<ExtractedVideo> {
  const html = await fetchText(link, { headers: { "User-Agent": UA } });
  const src = html.match(/"(https:\/\/[^"]+\.mp4[^"]*)"/)?.[1];
  if (!src) throw new Error("Amazon Drive: source not found");
  return { source: src, subtitles: [], headers: { Referer: link, "User-Agent": UA }, type: "mp4" };
}
