import { AsyncLocalStorage } from "node:async_hooks";
import { Agent, fetch as undiciFetch } from "undici";
import { fetchWithTimeout } from "../../fetch-timeout.js";
import { buildHeaders, type HeaderMode } from "./headers.js";
import { getCookieFetch } from "./cookies.js";
import { dohLookup } from "./doh.js";
import { isCloudflareChallenge } from "./cf-detect.js";
import { getCachedClearance, playwrightFetch } from "./cf-bypass.js";

const DEFAULT_TIMEOUT_MS = 30_000;

const cfContext = new AsyncLocalStorage<{ cfBypassUsed: boolean }>();

/** Whether the current async context used Playwright CF bypass. */
export function getCfBypassUsedInContext(): boolean {
  return cfContext.getStore()?.cfBypassUsed ?? false;
}

export function runWithCfContext<T>(fn: () => Promise<T>): Promise<T> {
  return cfContext.run({ cfBypassUsed: false }, fn);
}

function markCfBypassUsed(): void {
  const store = cfContext.getStore();
  if (store) store.cfBypassUsed = true;
}

const dohAgent = new Agent({
  connect: {
    lookup: dohLookup as never,
    rejectUnauthorized: true,
  },
});

export interface NetworkRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  redirect?: RequestRedirect;
  mode?: HeaderMode;
  referer?: string;
  origin?: string;
  method?: string;
  body?: string;
  skipCfBypass?: boolean;
}

export interface NetworkResponse {
  status: number;
  text: string;
  finalUrl: string;
  cfBypassUsed: boolean;
}

function mergeHeaders(mode: HeaderMode, options: NetworkRequestOptions): Record<string, string> {
  const h = buildHeaders(mode, options.headers ?? {});
  if (options.referer) h.Referer = options.referer;
  if (options.origin) h.Origin = options.origin;

  const cached = options.referer || options.origin;
  const probeUrl = cached?.startsWith("http") ? cached : undefined;
  if (probeUrl) {
    const clearance = getCachedClearance(probeUrl);
    if (clearance) h.Cookie = clearance;
  }
  return h;
}

function isCfShapedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("403") ||
    msg.includes("503") ||
    msg.includes("522") ||
    msg.includes("cloudflare") ||
    msg.includes("just a moment")
  );
}

async function rawFetch(
  url: string,
  options: NetworkRequestOptions
): Promise<Response> {
  const headers = mergeHeaders(options.mode ?? "document", options);
  const init = {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    redirect: options.redirect ?? "follow",
  } as RequestInit;

  const fetchImpl = getCookieFetch((input, reqInit) =>
    undiciFetch(input as string, {
      ...(reqInit as object),
      dispatcher: dohAgent,
    }) as unknown as Promise<Response>
  );

  try {
    return await fetchWithTimeout(url, init, options.timeoutMs ?? DEFAULT_TIMEOUT_MS, fetchImpl);
  } catch (dohErr) {
    // DoH/undici often fails on embed CDNs while system DNS works — fall back once.
    try {
      return await fetchWithTimeout(
        url,
        init,
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        fetch
      );
    } catch {
      throw dohErr;
    }
  }
}

export async function networkFetch(
  url: string,
  options: NetworkRequestOptions = {}
): Promise<NetworkResponse> {
  let cfBypassUsed = false;

  try {
    const res = await rawFetch(url, options);
    const text = await res.text();

    if (!options.skipCfBypass && isCloudflareChallenge(res.status, text)) {
      const pw = await playwrightFetch(url, mergeHeaders(options.mode ?? "document", options));
      cfBypassUsed = pw.cfBypassUsed;
      markCfBypassUsed();
      return {
        status: 200,
        text: pw.html,
        finalUrl: pw.finalUrl,
        cfBypassUsed,
      };
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    return {
      status: res.status,
      text,
      finalUrl: res.url || url,
      cfBypassUsed,
    };
  } catch (err) {
    if (options.skipCfBypass || !isCfShapedError(err)) throw err;

    const pw = await playwrightFetch(url, mergeHeaders(options.mode ?? "document", options));
    cfBypassUsed = pw.cfBypassUsed;
    markCfBypassUsed();
    return {
      status: 200,
      text: pw.html,
      finalUrl: pw.finalUrl,
      cfBypassUsed,
    };
  }
}

export async function fetchText(
  url: string,
  options: NetworkRequestOptions = {}
): Promise<string> {
  const res = await networkFetch(url, { ...options, mode: options.mode ?? "document" });
  return res.text;
}

export async function fetchJson<T>(
  url: string,
  options: NetworkRequestOptions = {}
): Promise<T> {
  const res = await networkFetch(url, { ...options, mode: options.mode ?? "json" });
  return JSON.parse(res.text) as T;
}

export async function fetchJsonPost<T>(
  url: string,
  body: unknown,
  options: NetworkRequestOptions = {}
): Promise<T> {
  const res = await networkFetch(url, {
    ...options,
    mode: options.mode ?? "json",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
  return JSON.parse(res.text) as T;
}

export async function fetchFormPost<T>(
  url: string,
  fields: Record<string, string>,
  options: NetworkRequestOptions = {}
): Promise<T> {
  const body = new URLSearchParams(fields).toString();
  const res = await networkFetch(url, {
    ...options,
    mode: options.mode ?? "xhr",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...options.headers,
    },
    body,
  });
  return JSON.parse(res.text) as T;
}
