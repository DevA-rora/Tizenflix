import type { IptvPlayResponse } from "./types.js";
import { findIptvProviderById, getEnabledIptvProviders } from "./registry.js";
import { detectStreamType } from "../../normalize/detect-type.js";
import type { PlayResponse } from "../../types.js";

export async function resolveIptvPlay(providerId: string, channelId: string): Promise<IptvPlayResponse> {
  const provider = findIptvProviderById(providerId);
  if (!provider || provider.enabled === false) {
    throw new Error(`IPTV provider not found or disabled: ${providerId}`);
  }

  const channels = await provider.getChannels();
  const channel = channels.find((c) => c.id === channelId);
  if (!channel) throw new Error(`Channel not found: ${channelId}`);

  const video = await provider.getStream(channelId);
  const type = video.type ?? detectStreamType(video.source);

  return {
    provider: provider.name,
    providerId: provider.id,
    channel,
    sources: [
      {
        url: video.source,
        type,
        headers: video.headers,
      },
    ],
  };
}

export async function resolveIptvPlayResponse(providerId: string, channelId: string): Promise<PlayResponse> {
  const iptv = await resolveIptvPlay(providerId, channelId);
  const sources = iptv.sources.map((s, i) => ({
    id: String(i),
    provider: iptv.provider,
    label: iptv.channel.name,
    type: (s.type === "m3u8" || s.type === "mp4" || s.type === "dash" ? s.type : detectStreamType(s.url)) as
      | "mp4"
      | "m3u8"
      | "dash"
      | "unknown",
    url: s.url,
    priority: i,
    upstreamHeaders: s.headers,
  }));
  return {
    title: iptv.channel.name,
    type: "movie",
    tmdbId: `live:${providerId}:${channelId.slice(0, 32)}`,
    sources,
    recommended: sources[0]?.url ?? null,
    subtitles: [],
    nextEpisode: null,
    backend: "streamflix",
  };
}

export function listIptvProviders() {
  return getEnabledIptvProviders().map((p) => ({
    id: p.id,
    name: p.name,
    language: p.language,
    logo: p.logo,
    enabled: p.enabled !== false,
  }));
}

export async function listIptvChannels(providerId: string) {
  const provider = findIptvProviderById(providerId);
  if (!provider) throw new Error(`IPTV provider not found: ${providerId}`);
  return provider.getChannels();
}
