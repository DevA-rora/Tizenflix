import type { ExtractedVideo } from "../types.js";

export interface IptvChannel {
  id: string;
  name: string;
  logo?: string;
  group?: string;
}

export interface IptvProvider {
  id: string;
  name: string;
  language: string;
  logo?: string;
  enabled?: boolean;
  getChannels(): Promise<IptvChannel[]>;
  getStream(channelId: string): Promise<ExtractedVideo>;
}

export interface IptvPlayResponse {
  provider: string;
  providerId: string;
  channel: IptvChannel;
  sources: Array<{
    url: string;
    type?: string;
    headers?: Record<string, string>;
  }>;
}
