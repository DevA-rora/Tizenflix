import { twoEmbedExtractor } from "../src/streamflix/extractors/two-embed.js";
import { vidsrcNetExtractor } from "../src/streamflix/extractors/vidsrc-net.js";
import { vidzeeExtractor } from "../src/streamflix/extractors/vidzee.js";
import { vidrockExtractor } from "../src/streamflix/extractors/vidrock.js";

async function tryExt(name, fn) {
  const t0 = Date.now();
  try {
    const v = await fn();
    console.log(name, "OK", Date.now() - t0 + "ms", v.source?.slice(0, 100));
  } catch (e) {
    console.log(name, "FAIL", Date.now() - t0 + "ms", e.message?.slice(0, 100));
  }
}

await tryExt("2Embed", () => twoEmbedExtractor.extract("https://www.2embed.cc/embed/27205"));
await tryExt("VidsrcNet", () =>
  vidsrcNetExtractor.extract("https://vidsrc-embed.ru/embed/movie?tmdb=27205")
);
await tryExt("Vidzee", () =>
  vidzeeExtractor.extract("https://player.vidzee.wtf/api/server?id=27205&sr=0")
);
