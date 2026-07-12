import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import type { ExtractedVideo } from "../types.js";
import { fetchText } from "../http.js";

const API_BASE = "https://showbox.shegu.net/api/api_client/index/";
const IV = Buffer.from("d0VpcGhUbiE=", "base64");
const KEY = Buffer.from("MTIzZDZjZWRmNjI2ZHk1NDIzM2FhMXc2", "base64");
const APP_KEY = "moviebox";
const APP_ID = "com.tdo.showbox";
const APP_ID_SECOND = "com.movieboxpro.android";
const APP_VERSION = "11.5";
const APP_VERSION_CODE = "160";

function md5Hex(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

function des3Encrypt(plain: string): string {
  const keyBuf = Buffer.alloc(24);
  KEY.copy(keyBuf, 0, 0, Math.min(KEY.length, 24));
  const cipher = createCipheriv("des-ede3-cbc", keyBuf, IV);
  return Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]).toString("base64");
}

function randomToken(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

const sessionToken = randomToken();

function queryApi(query: Record<string, string>): Record<string, string> {
  const encrypted = des3Encrypt(JSON.stringify(query));
  const appKeyHash = md5Hex(APP_KEY);
  const verify = md5Hex(md5Hex(APP_KEY) + KEY.toString("utf8") + encrypted);
  const body = Buffer.from(
    JSON.stringify({ app_key: appKeyHash, verify, encrypt_data: encrypted })
  ).toString("base64");

  return {
    data: body,
    appid: "27",
    platform: "android",
    version: APP_VERSION_CODE,
    medium: `Website&token${sessionToken}`,
  };
}

function expiryDate(): string {
  return String(Date.now() + 12 * 60 * 60 * 1000);
}

async function postApi<T>(fields: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(fields).toString();
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      Accept: "charset=utf-8",
      Platform: "android",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`SuperStream HTTP ${res.status}`);
  const json = (await res.json()) as { code: number; msg: string; data: T };
  if (json.code !== 1) throw new Error(json.msg || "SuperStream API error");
  return json.data;
}

interface SearchShow {
  id: number;
  box_type: number;
  title?: string;
  tmdb_id?: number;
}

interface LinkItem {
  path?: string;
  quality?: string;
  size?: string;
  fid?: number;
}

interface LinkResponse {
  list: LinkItem[];
}

interface SubtitleItem {
  language?: string;
  file_path?: string;
}

interface SubtitleResponse {
  list: Array<{ subtitles: SubtitleItem[] }>;
}

export async function superStreamFindByTmdb(
  tmdbId: string,
  type: "movie" | "tv",
  title: string
): Promise<{ id: string; title: string } | null> {
  const data = await postApi<SearchShow[]>(
    queryApi({
      childmode: "1",
      app_version: APP_VERSION,
      appid: APP_ID,
      module: "Search3",
      channel: "Website",
      page: "1",
      lang: "en",
      type: "all",
      keyword: title || tmdbId,
      pagelimit: "20",
      expired_date: expiryDate(),
      platform: "android",
    })
  );

  const wantBox = type === "movie" ? 1 : 2;
  const match =
    data.find((d) => d.tmdb_id === parseInt(tmdbId, 10) && d.box_type === wantBox) ??
    data.find((d) => d.box_type === wantBox);
  if (!match) return null;
  return { id: String(match.id), title: match.title ?? title };
}

export async function superStreamGetServers(
  id: string,
  type: "movie" | "tv",
  season: string,
  episode: string
): Promise<Array<{ name: string; src: string; subtitles: ExtractedVideo["subtitles"] }>> {
  const sources =
    type === "movie"
      ? await postApi<LinkResponse>(
          queryApi({
            childmode: "1",
            uid: "",
            app_version: APP_VERSION,
            appid: APP_ID,
            module: "Movie_downloadurl_v3",
            channel: "Website",
            mid: id,
            lang: "",
            expired_date: expiryDate(),
            platform: "android",
            oss: "1",
            group: "",
          })
        )
      : await postApi<LinkResponse>(
          queryApi({
            childmode: "1",
            app_version: APP_VERSION,
            module: "TV_downloadurl_v3",
            channel: "Website",
            episode,
            expired_date: expiryDate(),
            platform: "android",
            tid: id,
            oss: "1",
            uid: "",
            appid: APP_ID,
            season,
            lang: "en",
            group: "",
          })
        );

  const fid = sources.list.find((l) => l.fid)?.fid ?? 0;

  const subtitlesData =
    type === "movie"
      ? await postApi<SubtitleResponse>(
          queryApi({
            childmode: "1",
            fid: String(fid),
            uid: "",
            app_version: APP_VERSION,
            appid: APP_ID,
            module: "Movie_srt_list_v2",
            channel: "Website",
            mid: id,
            lang: "en",
            expired_date: expiryDate(),
            platform: "android",
          })
        )
      : await postApi<SubtitleResponse>(
          queryApi({
            childmode: "1",
            fid: String(fid),
            app_version: APP_VERSION,
            module: "TV_srt_list_v2",
            channel: "Website",
            episode,
            expired_date: expiryDate(),
            platform: "android",
            tid: id,
            uid: "",
            appid: APP_ID,
            season,
            lang: "en",
          })
        );

  const subtitles: ExtractedVideo["subtitles"] = [];
  for (const group of subtitlesData.list) {
    for (const sub of group.subtitles) {
      if (!sub.file_path) continue;
      subtitles.push({ label: sub.language ?? "Unknown", file: sub.file_path });
    }
  }

  return sources.list
    .filter((l) => l.path)
    .map((l, i) => ({
      name: `${l.quality ?? "Stream"} • ${l.size ?? ""}`.trim(),
      src: l.path!,
      subtitles,
    }));
}
