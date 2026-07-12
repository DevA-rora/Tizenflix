import { VIDKING_HEADERS } from "../constants/headers.js";
import {
  rewriteM3u8,
  shouldRewriteAsM3u8,
  looksLikeM3u8Url,
  looksLikeM3u8ContentType,
} from "./rewrite-m3u8.js";

export const UPSTREAM_HEADERS: HeadersInit = {
  ...VIDKING_HEADERS,
};

export interface ProxyStreamResult {
  status: number;
  contentType: string | null;
  body: string | Uint8Array;
  rewritten: boolean;
}

/** Fetch upstream media; rewrite m3u8 playlists for Tizen-safe playback */
export async function fetchProxiedStream(
  targetUrl: string,
  publicBase: string,
  fetchImpl: typeof fetch = fetch
): Promise<ProxyStreamResult> {
  const upstream = await fetchImpl(targetUrl, {
    headers: UPSTREAM_HEADERS,
    redirect: "follow",
  });

  const contentType = upstream.headers.get("content-type");

  const mightBeM3u8 =
    looksLikeM3u8Url(targetUrl) || looksLikeM3u8ContentType(contentType);

  if (mightBeM3u8) {
    const text = await upstream.text();
    if (shouldRewriteAsM3u8(targetUrl, contentType, text)) {
      return {
        status: upstream.status,
        contentType: "application/vnd.apple.mpegurl",
        body: rewriteM3u8(text, targetUrl, publicBase),
        rewritten: true,
      };
    }
    return {
      status: upstream.status,
      contentType,
      body: text,
      rewritten: false,
    };
  }

  const buffer = new Uint8Array(await upstream.arrayBuffer());
  return {
    status: upstream.status,
    contentType,
    body: buffer,
    rewritten: false,
  };
}
