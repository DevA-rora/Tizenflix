import { streamingCommunityEnProvider } from "./streaming-community-en.js";
import type { ContentProvider } from "./types.js";

const IT_DOMAIN = "streamingunity.dog";

export const streamingCommunityItProvider: ContentProvider = {
  ...streamingCommunityEnProvider,
  id: "streaming-community-it",
  name: "StreamingCommunity (IT)",
  language: "it",
  implementationStatus: "full",
  async findByTmdb(tmdbId, type, meta) {
    const { fetchJson } = await import("../http.js");
    const BASE = `https://${IT_DOMAIN}/`;
    const res = await fetchJson<{ data: Array<{ id: string; name: string; type: string; tmdb_id?: number; slug: string }> }>(
      `${BASE}search?q=${encodeURIComponent(meta.title)}&page=1&lang=it`,
      { headers: { Accept: "application/json", Referer: BASE, Origin: BASE } }
    );
    const want = type === "movie" ? "movie" : "tv";
    const match =
      res.data?.find((d) => d.tmdb_id === parseInt(tmdbId, 10) && d.type === want) ??
      res.data?.find((d) => d.type === want);
    if (!match) return null;
    return {
      providerId: "streaming-community-it",
      contentId: match.id,
      title: match.name,
      slug: match.slug,
    };
  },
};
