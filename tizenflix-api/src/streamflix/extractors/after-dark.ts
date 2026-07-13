import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";

const DEFAULT_URL = "https://afterdark.best";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const PROVIDER_HASHES: Array<[string, string]> = [
  ["Premium", "aa86800c3ec95e610210f8378c316734ee92a09ee00f8c708c1a06c616651e8f"],
  ["Raven (fdla)", "63e997074c73a7b57239e53ac7618f3e1ef81bda3f0ab47ee0ecc82bf0493904"],
  ["Willow (zekd)", "ffe22be1dcd9d941bd4d09121338c70500fc067dcd94b1168079ba789e7c46c4"],
  ["Alpha (lkua)", "d7ae23a39378ba1864d998d52c010e969f8344ebaebf97436d9c7bf3b592667d"],
  ["Yuna (msfu)", "24758778992d2473ae2618adf856f8902a675718eef18169c854d07d1fcad298"],
  ["Ive (iodv)", "70b726570a3111d2c6d51ae57139e4af4b69392ebbf32293c5d7f7ec53922cd5"],
  ["Lumi (redu)", "e818c6028fbd6b8c58ce3cdb1d8be2972ffa0a486361fc07b7e9d2bd0c2d95f2"],
  ["Beta (zele)", "e89c6cdf5d5296dd5f0e864a030efdfcaa1896773fb9f0d7e6926acaed7f4a86"],
  ["Bunny (ofsa)", "dc4cc6245be6fec3d7ea391bfac09cb5d4090e5135629b0e6e81bacd3d10e8dc"],
  ["Gamma (offi)", "c3ce337885c3aae80534c9fa298aae6a4b37fa0188c09238610beeacd553caf1"],
];

const PROXY_PREFIXES: Record<string, string> = {
  voe: "https://proxy.afterdark.baby/boom-clap?url=",
  vidmoly: "https://proxy.afterdark.baby/elizabeth-taylor?url=",
  uqload: "https://proxy.afterdark.baby/alejandro?url=",
  vidzy: "https://proxy.afterdark.baby/rolly?url=",
};

function buildPayload(
  title: string,
  type: string,
  tmdbId: string,
  imdbId: string,
  year: string,
  season = 1,
  episode = 1
): string {
  return `{"t":{"t":10,"i":0,"p":{"k":["data"],"v":[{"t":10,"i":1,"p":{"k":["title","type","tmdbId","imdbId","releaseYear","season","episode"],"v":[{"t":1,"s":"${title}"},{"t":1,"s":"${type}"},{"t":1,"s":"${tmdbId}"},{"t":1,"s":"${imdbId}"},{"t":1,"s":"${year}"},{"t":2,"s":${season}},{"t":2,"s":${episode}]},"o":0}]},"o":0},"f":63,"m":[]}`;
}

function parseBlocks(body: string): Array<Record<string, string>> {
  const blocks: Array<Record<string, string>> = [];
  const blockRe = /"k":\[([^\]]+)\],"v":\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(body)) !== null) {
    const keysStr = match[1] ?? "";
    const valsStr = match[2] ?? "";
    const keys = keysStr.split(",").map((k) => k.trim().replace(/^"|"$/g, ""));
    const vals: string[] = [];
    const valRe = /"s":"([^"]*)"/g;
    let vm: RegExpExecArray | null;
    while ((vm = valRe.exec(valsStr)) !== null) {
      vals.push(vm[1] ?? "");
    }
    if (keys.length !== vals.length) continue;
    const data: Record<string, string> = {};
    for (let i = 0; i < keys.length; i++) {
      data[keys[i]!] = vals[i]!;
    }
    blocks.push(data);
  }
  return blocks;
}

export async function buildAfterDarkEntries(
  opts: {
    type: "movie" | "tv";
    tmdbId: string;
    title: string;
    imdbId?: string;
    year?: string | number;
    season?: string;
    episode?: string;
  },
  baseUrl = DEFAULT_URL
): Promise<Array<{ name: string; url: string; headers?: Record<string, string> }>> {
  const year = String(opts.year ?? "").split("-")[0] || "0";
  const payload =
    opts.type === "movie"
      ? buildPayload(opts.title, "movie", opts.tmdbId, opts.imdbId ?? "0", year)
      : buildPayload(
          opts.title,
          "tv",
          opts.tmdbId,
          opts.imdbId ?? "0",
          year,
          parseInt(opts.season ?? "1", 10),
          parseInt(opts.episode ?? "1", 10)
        );

  const encodedPayload = encodeURIComponent(payload);
  const entries: Array<{ name: string; url: string; headers?: Record<string, string> }> = [];
  const seen = new Set<string>();

  for (const [pName, pHash] of PROVIDER_HASHES) {
    const apiUrl = `${baseUrl}/_serverFn/${pHash}?payload=${encodedPayload}`;
    try {
      const body = await fetchText(apiUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: `${baseUrl}/`,
          "X-Requested-With": "XMLHttpRequest",
          "x-tsr-serverfn": "true",
        },
        referer: `${baseUrl}/`,
      });

      if (body.includes('"error":') && body.includes('"details":')) continue;

      for (const data of parseBlocks(body)) {
        const service = (data.service ?? "").toLowerCase();
        const rawUrl = data.url ?? data.embedUrl;
        if (!rawUrl) continue;

        let url = rawUrl;
        const proxyPrefix = PROXY_PREFIXES[service];
        let isSource = false;

        if (pName === "Premium") {
          url = rawUrl;
          isSource = true;
        } else if (proxyPrefix) {
          url = `${proxyPrefix}${encodeURIComponent(rawUrl)}`;
          isSource = true;
        } else if (service === "unknown" || !service) {
          isSource = true;
        }

        if (!isSource || !url.startsWith("http") || seen.has(url)) continue;
        seen.add(url);

        const resolvedProv = data.provider ?? pName.split(" ")[0]!;
        const quality = data.quality ?? "hd";
        const language = data.language ?? "vf";
        entries.push({
          name: `${resolvedProv} • ${quality} • ${language}`,
          url,
          headers: { Referer: `${baseUrl}/`, "User-Agent": USER_AGENT },
        });
      }
    } catch {
      /* try next hash */
    }
  }

  return entries;
}

async function extractAfterDark(link: string): Promise<ExtractedVideo> {
  if (/\.m3u8/i.test(link) || /\.mp4/i.test(link)) {
    return {
      source: link,
      subtitles: [],
      headers: { Referer: `${DEFAULT_URL}/`, "User-Agent": USER_AGENT },
    };
  }
  throw new Error("AfterDark: use buildAfterDarkEntries for server discovery");
}

/** Ported from Streamflix AfterDarkExtractor */
export const afterDarkExtractor: ExtractorDef = {
  name: "AfterDark",
  mainUrl: DEFAULT_URL,
  aliasUrls: ["https://afterdark.best", "https://proxy.afterdark.baby"],
  extract: extractAfterDark,
};
