/** Mobile Android UA matching Streamflix NetworkClient.kt */
export const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";

export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type HeaderMode = "document" | "xhr" | "json";

export function buildHeaders(
  mode: HeaderMode,
  extra: Record<string, string> = {}
): Record<string, string> {
  const base: Record<string, string> = {
    "User-Agent": MOBILE_UA,
    "Accept-Language": "en-US,en;q=0.9",
    ...extra,
  };

  if (mode === "json" || mode === "xhr") {
    base.Accept = "application/json, text/javascript, */*; q=0.01";
    if (mode === "json") base.Platform = "android";
    return base;
  }

  base.Accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  base["Sec-Fetch-Dest"] = "document";
  base["Sec-Fetch-Mode"] = "navigate";
  base["Sec-Fetch-Site"] = "none";
  base["Upgrade-Insecure-Requests"] = "1";
  return base;
}
