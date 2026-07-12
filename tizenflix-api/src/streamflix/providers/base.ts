import type { ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";

export function stubFindByTmdb(providerName: string) {
  return async (
    _tmdbId: string,
    _type: "movie" | "tv",
    _meta: { title: string }
  ): Promise<ProviderMatch | null> => null;
}

export async function stubGetServers(
  _match: ProviderMatch,
  _type: "movie" | "tv",
  _season?: string,
  _episode?: string
): Promise<StreamServer[]> {
  return [];
}

export async function stubGetVideo(_server: StreamServer): Promise<ExtractedVideo> {
  throw new Error("Provider video extraction not implemented");
}
