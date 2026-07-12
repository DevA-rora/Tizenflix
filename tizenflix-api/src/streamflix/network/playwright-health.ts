export interface PlaywrightHealthResult {
  ready: boolean;
  message: string;
}

/** Check whether Playwright Chromium binaries are installed and launchable. */
export async function checkPlaywrightReady(): Promise<PlaywrightHealthResult> {
  if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1") {
    return { ready: false, message: "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1" };
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    await browser.close();
    return { ready: true, message: "Chromium ready" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ready: false,
      message: `Chromium not installed. Run: npm run setup (${detail})`,
    };
  }
}

export function formatPlaywrightSetupHelp(): string {
  return [
    "Playwright Chromium is required for Streamflix CF-protected providers (SFlix, Ridomovies, etc.).",
    "Install with:  cd tizenflix-api && npm run setup",
    "Or:           npx playwright install chromium",
  ].join("\n");
}
