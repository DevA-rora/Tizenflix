/** Headers mimicking Vidking embed player requests */
export const VIDKING_HEADERS: HeadersInit = {
  Accept: "*/*",
  Origin: "https://www.vidking.net",
  Referer: "https://www.vidking.net/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
};

export const NO_CACHE_HEADERS: HeadersInit = {
  ...VIDKING_HEADERS,
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
