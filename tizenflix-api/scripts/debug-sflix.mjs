import { findSflixMovieId, getSflixServers, extractSflixServer } from "../src/streamflix/providers/sflix.js";

try {
  const id = await findSflixMovieId("27205", "Inception");
  console.log("movieId", id);
  if (!id) process.exit(1);
  const servers = await getSflixServers(id, "movie");
  console.log("servers", servers.map((s) => s.name));
  const video = await extractSflixServer(servers[0]);
  console.log("source", video.source?.slice(0, 100));
} catch (e) {
  console.error("ERR", e);
  process.exit(1);
}
