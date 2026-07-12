/** Backward-compatible HTTP facade — delegates to network stack. */
import {
  fetchText as netFetchText,
  fetchJson as netFetchJson,
  fetchJsonPost as netFetchJsonPost,
  type NetworkRequestOptions,
} from "./network/client.js";
import { MOBILE_UA } from "./network/headers.js";

export const BROWSER_UA = MOBILE_UA;

export interface FetchHtmlOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  redirect?: RequestRedirect;
  referer?: string;
  origin?: string;
}

function toNetOptions(options: FetchHtmlOptions): NetworkRequestOptions {
  return {
    headers: options.headers,
    timeoutMs: options.timeoutMs,
    redirect: options.redirect,
    referer: options.referer,
    origin: options.origin,
  };
}

export async function fetchText(
  url: string,
  options: FetchHtmlOptions = {},
  _fetchImpl?: typeof fetch
): Promise<string> {
  return netFetchText(url, toNetOptions(options));
}

export async function fetchJson<T>(
  url: string,
  options: FetchHtmlOptions = {},
  _fetchImpl?: typeof fetch
): Promise<T> {
  return netFetchJson<T>(url, toNetOptions(options));
}

export async function fetchJsonPost<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  _fetchImpl?: typeof fetch
): Promise<T> {
  return netFetchJsonPost<T>(url, body, { headers });
}
