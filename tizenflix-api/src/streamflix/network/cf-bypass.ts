import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOBILE_UA } from "./headers.js";
import { setCookiesFromString } from "./cookies.js";
import { CF_MARKERS } from "./cf-detect.js";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data");
const CLEARANCE_FILE = join(DATA_DIR, "cf-clearance.json");

type ClearanceEntry = {
  cookies: string;
  obtainedAt: number;
};

type ClearanceStore = Record<string, ClearanceEntry>;

const CLEARANCE_TTL_MS = 45 * 60 * 1000;

let browserPromise: Promise<import("playwright").Browser> | null = null;
let context: import("playwright").BrowserContext | null = null;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadClearanceStore(): ClearanceStore {
  ensureDataDir();
  if (!existsSync(CLEARANCE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CLEARANCE_FILE, "utf8")) as ClearanceStore;
  } catch {
    return {};
  }
}

function saveClearanceStore(store: ClearanceStore): void {
  ensureDataDir();
  writeFileSync(CLEARANCE_FILE, JSON.stringify(store, null, 2));
}

function domainFromUrl(url: string): string {
  return new URL(url).hostname;
}

export function getCachedClearance(url: string): string | null {
  const domain = domainFromUrl(url);
  const store = loadClearanceStore();
  const entry = store[domain];
  if (!entry) return null;
  if (Date.now() - entry.obtainedAt > CLEARANCE_TTL_MS) return null;
  return entry.cookies;
}

function cacheClearance(url: string, cookies: string): void {
  const domain = domainFromUrl(url);
  const store = loadClearanceStore();
  store[domain] = { cookies, obtainedAt: Date.now() };
  saveClearanceStore(store);
}

async function getBrowser(): Promise<import("playwright").Browser> {
  if (!browserPromise) {
    const { chromium } = await import("playwright");
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    }).catch((err) => {
      browserPromise = null;
      throw new Error(
        `Playwright Chromium not installed. Run: npx playwright install chromium (${err instanceof Error ? err.message : err})`
      );
    });
  }
  return browserPromise;
}

async function getContext(): Promise<import("playwright").BrowserContext> {
  if (!context) {
    const browser = await getBrowser();
    context = await browser.newContext({
      userAgent: MOBILE_UA,
      viewport: { width: 390, height: 844 },
      locale: "en-US",
    });
  }
  return context;
}

export interface PlaywrightFetchResult {
  html: string;
  finalUrl: string;
  cookies: string;
  cfBypassUsed: boolean;
}

let activeCfBypass = 0;
const MAX_CONCURRENT_CF = 2;
const cfQueue: Array<() => void> = [];

async function acquireCfSlot(): Promise<void> {
  if (activeCfBypass < MAX_CONCURRENT_CF) {
    activeCfBypass++;
    return;
  }
  await new Promise<void>((resolve) => cfQueue.push(resolve));
  activeCfBypass++;
}

function releaseCfSlot(): void {
  activeCfBypass--;
  const next = cfQueue.shift();
  if (next) next();
}

export async function playwrightFetch(
  url: string,
  headers: Record<string, string> = {}
): Promise<PlaywrightFetchResult> {
  await acquireCfSlot();
  const ctx = await getContext();
  const page = await ctx.newPage();

  try {
    const cached = getCachedClearance(url);
    if (cached) {
      const domain = domainFromUrl(url);
      await ctx.addCookies(
        cached.split(";").map((c) => {
          const [name, ...rest] = c.trim().split("=");
          return {
            name: name ?? "",
            value: rest.join("="),
            domain,
            path: "/",
          };
        })
      );
    }

    await page.setExtraHTTPHeaders(headers);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });

    const deadline = Date.now() + 90_000;
    let html = await page.content();

    while (Date.now() < deadline) {
      const lower = html.toLowerCase();
      const challenged = CF_MARKERS.some((m) => lower.includes(m.toLowerCase()));
      if (!challenged) break;
      await page.waitForTimeout(2000);
      html = await page.content();
    }

    const cookies = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const finalUrl = page.url();

    if (cookies.includes("cf_clearance")) {
      cacheClearance(url, cookies);
      await setCookiesFromString(url, cookies);
    }

    return { html, finalUrl, cookies, cfBypassUsed: true };
  } finally {
    await page.close();
    releaseCfSlot();
  }
}

export async function closePlaywright(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}
