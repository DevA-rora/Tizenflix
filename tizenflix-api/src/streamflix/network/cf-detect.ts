/** Cloudflare challenge markers from Streamflix WebViewResolver.kt */
export const CF_MARKERS = [
  "Just a moment...",
  "cf-browser-verification",
  "challenge-running",
  "Checking your browser",
  "cloudflare",
] as const;

export function isCloudflareChallenge(status: number, body: string): boolean {
  if (status === 403 || status === 503 || status === 522) return true;
  const lower = body.slice(0, 8000).toLowerCase();
  return CF_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}
