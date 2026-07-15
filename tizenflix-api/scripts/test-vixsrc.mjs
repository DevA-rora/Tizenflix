import { extractVideo } from "../dist/streamflix/extractors/registry.js";
import { vixSrcExtractor } from "../dist/streamflix/extractors/vix-src.js";

async function main() {
  try {
    const v = await vixSrcExtractor.extract("https://vixsrc.to/api/movie/27205");
    console.log("vixsrc direct", v.source?.slice(0, 150));
  } catch (e) {
    console.error("vixsrc direct err", e.message);
  }
  try {
    const v = await extractVideo("https://vixsrc.to/api/movie/27205", "VixSrc");
    console.log("extractVideo", v.source?.slice(0, 150));
  } catch (e) {
    console.error("extractVideo err", e.message);
  }
}

main();
