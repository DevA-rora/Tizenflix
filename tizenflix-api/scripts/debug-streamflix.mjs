import { resolveStreamflixFromOptions } from "../src/streamflix/resolve.js";

try {
  const play = await resolveStreamflixFromOptions({ type: "movie", tmdbId: "27205" });
  console.log("backend", play.backend);
  console.log("sources", play.sources.length);
  if (play.sources[0]) console.log("first", play.sources[0].provider, play.sources[0].type);
  console.log("subtitles", play.subtitles.length);
  if (play.warnings) console.log("warnings", play.warnings);
} catch (e) {
  console.error("ERR", e);
  process.exit(1);
}
