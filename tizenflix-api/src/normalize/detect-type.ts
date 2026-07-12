export function detectStreamType(url: string): "mp4" | "m3u8" | "unknown" {
  if (!url) return "unknown";
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8") || lower.includes("m3u8")) return "m3u8";
  if (
    lower.includes(".mp4") ||
    lower.includes(".webm") ||
    lower.includes("video/mp4") ||
    lower.includes("/mp4/")
  ) {
    return "mp4";
  }
  return "unknown";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
