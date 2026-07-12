import { chromium } from "playwright";

/** Intercept m3u8 or JSON API responses while loading an embed page (VidLink, VidsrcRu). */
export async function interceptEmbedRequest(
  url: string,
  matchers: Array<{ pattern: RegExp; type: "m3u8" | "json"; jsonPath?: string }>,
  timeoutMs = Number(process.env.BENCHMARK_PLAYWRIGHT_TIMEOUT_MS ?? 30_000)
): Promise<{ url: string; json?: unknown }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Playwright embed timeout"));
      }, timeoutMs);

      page.on("response", async (response) => {
        const resUrl = response.url();
        for (const m of matchers) {
          if (!m.pattern.test(resUrl)) continue;
          try {
            if (m.type === "m3u8") {
              clearTimeout(timer);
              resolve({ url: resUrl });
              return;
            }
            const json = await response.json();
            clearTimeout(timer);
            resolve({ url: resUrl, json });
            return;
          } catch {
            /* try next */
          }
        }
      });

      page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  } finally {
    await browser.close();
  }
}
