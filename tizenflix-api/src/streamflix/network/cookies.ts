import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CookieJar } from "tough-cookie";
import makeFetchCookie from "fetch-cookie";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data");
const COOKIE_FILE = join(DATA_DIR, "streamflix-cookies.json");

let jar: CookieJar | null = null;
let cookieFetch: typeof fetch | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function getCookieJar(): CookieJar {
  if (jar) return jar;
  jar = new CookieJar();
  ensureDataDir();
  if (existsSync(COOKIE_FILE)) {
    try {
      const raw = readFileSync(COOKIE_FILE, "utf8");
      const data = JSON.parse(raw) as { cookies?: string };
      if (data.cookies) {
        jar = CookieJar.deserializeSync(data.cookies);
      }
    } catch {
      jar = new CookieJar();
    }
  }
  return jar;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      ensureDataDir();
      const serialized = getCookieJar().serializeSync();
      writeFileSync(COOKIE_FILE, JSON.stringify({ cookies: serialized }, null, 2));
    } catch {
      /* best effort */
    }
  }, 500);
}

export function getCookieFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  if (!cookieFetch) {
    cookieFetch = makeFetchCookie(baseFetch, getCookieJar(), true) as typeof fetch;
    const original = cookieFetch;
    cookieFetch = (async (input, init) => {
      const res = await original(input, init);
      schedulePersist();
      return res;
    }) as typeof fetch;
  }
  return cookieFetch;
}

export async function setCookiesFromString(url: string, cookieHeader: string): Promise<void> {
  const j = getCookieJar();
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      await j.setCookie(trimmed, url);
    } catch {
      /* skip invalid */
    }
  }
  schedulePersist();
}
