import { twoEmbedExtractor } from "../dist/streamflix/extractors/two-embed.js";
import { vidsrcNetExtractor } from "../dist/streamflix/extractors/vidsrc-net.js";
import { vidzeeExtractor } from "../dist/streamflix/extractors/vidzee.js";
import { vidsrcToExtractor } from "../dist/streamflix/extractors/vidsrc-to.js";
import { vidrockExtractor } from "../dist/streamflix/extractors/vidrock.js";
import { buildVidrockApiUrl } from "../dist/streamflix/tmdb-native/registry.js";

const TIMEOUT_MS = 60_000;

const PROBES = [
  {
    name: "Vidrock",
    fn: async () => {
      const api = buildVidrockApiUrl({ type: "movie", tmdbId: "27205" });
      return vidrockExtractor.extract(`${api}#Orion`);
    },
  },
  {
    name: "Vidzee",
    fn: async () => {
      const urls = [
        "https://player.vidzee.wtf/api/server?id=27205&sr=3",
        "https://player.vidzee.wtf/api/server?id=550&sr=3",
      ];
      let lastErr = null;
      for (const url of urls) {
        try {
          return await vidzeeExtractor.extract(url);
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr ?? new Error("Vidzee: all probes failed");
    },
  },
  {
    name: "2Embed",
    fn: () => twoEmbedExtractor.extract("https://www.2embed.cc/embed/27205"),
  },
  {
    name: "VidsrcNet",
    fn: () => vidsrcNetExtractor.extract("https://vidsrc-embed.ru/embed/movie?tmdb=27205"),
  },
  {
    name: "Vidsrc.to",
    fn: () => vidsrcToExtractor.extract("https://vidsrc.to/embed/movie/27205"),
  },
];

async function tryExt(name, fn) {
  const t0 = Date.now();
  try {
    const v = await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("probe timeout")), TIMEOUT_MS)
      ),
    ]);
    const ms = Date.now() - t0;
    const kind = v.source.includes(".m3u8") ? "HLS" : v.source.includes(".mp4") ? "MP4" : "URL";
    console.log(`OK  ${name.padEnd(12)} ${ms}ms ${kind} ${v.source.slice(0, 90)}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${name.padEnd(12)} ${Date.now() - t0}ms ${String(e?.message || e).slice(0, 120)}`);
    return false;
  }
}

let ok = 0;
for (const p of PROBES) {
  if (await tryExt(p.name, p.fn)) ok++;
}
console.log(`\n${ok}/${PROBES.length} passed (2+ required for backup tier)`);
process.exit(ok >= 2 ? 0 : 1);
