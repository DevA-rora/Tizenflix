/**
 * Request deduplication to prevent multiple identical upstream fetches.
 * When multiple clients request the same resource simultaneously, only one upstream fetch occurs.
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest<globalThis.Response>>();
const DEDUP_TIMEOUT_MS = 5_000; // Clear pending requests after 5 seconds

function createRequestKey(
  url: string,
  headers?: HeadersInit
): string {
  const headerStr = headers
    ? JSON.stringify(
        Object.entries(headers as Record<string, string>)
          .sort(([a], [b]) => a.localeCompare(b))
      )
    : "";
  return `${url}::${headerStr}`;
}

/**
 * Deduplicate concurrent requests. If an identical request is already in flight,
 * wait for it instead of making a new upstream fetch.
 */
export async function deduplicatedFetch(
  url: string,
  fetchFn: () => Promise<globalThis.Response>,
  headers?: HeadersInit
): Promise<globalThis.Response> {
  const key = createRequestKey(url, headers);
  const existing = pendingRequests.get(key);

  if (existing) {
    // Request already in flight - wait for it
    console.log(`[DEDUP] Waiting for in-flight request: ${url.substring(0, 80)}`);
    try {
      // Clone the response so both callers can read the body
      const response = await existing.promise;
      return response.clone();
    } catch (err) {
      // If the original request failed, remove it and retry
      pendingRequests.delete(key);
      throw err;
    }
  }

  // No existing request - create new one
  const promise = fetchFn();
  pendingRequests.set(key, {
    promise,
    timestamp: Date.now(),
  });

  try {
    const response = await promise;
    // Keep in pending for a brief moment to catch rapid successive requests
    setTimeout(() => pendingRequests.delete(key), 100);
    return response;
  } catch (err) {
    pendingRequests.delete(key);
    throw err;
  }
}

/**
 * Clear old pending requests (cleanup for memory leaks)
 */
export function clearOldPendingRequests(): void {
  const now = Date.now();
  const keys = Array.from(pendingRequests.keys());
  for (const key of keys) {
    const pending = pendingRequests.get(key)!;
    if (now - pending.timestamp > DEDUP_TIMEOUT_MS) {
      pendingRequests.delete(key);
    }
  }
}

/**
 * Get deduplication statistics
 */
export function getDedupStats(): {
  pendingCount: number;
} {
  return {
    pendingCount: pendingRequests.size,
  };
}

// Periodic cleanup
setInterval(clearOldPendingRequests, DEDUP_TIMEOUT_MS);
