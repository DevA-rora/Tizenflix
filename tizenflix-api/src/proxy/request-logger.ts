/**
 * Request logging and tracking for proxy to diagnose rate limiting and performance issues.
 */

interface RequestLog {
  timestamp: number;
  url: string;
  host: string;
  type: "manifest" | "segment" | "other";
  status: number;
  duration: number;
  cached: boolean;
  rateLimited: boolean;
  clientIp?: string;
}

interface ClientRequestStats {
  ip: string;
  requestCount: number;
  rateLimitCount: number;
  lastRequestTime: number;
  windowStart: number;
}

const REQUEST_LOG_SIZE = 200;
const STATS_WINDOW_MS = 10_000; // 10 second rolling window

const requestLog: RequestLog[] = [];
const clientStats = new Map<string, ClientRequestStats>();

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function detectContentType(url: string): "manifest" | "segment" | "other" {
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8") || lower.includes("m3u8?")) return "manifest";
  if (/\.(ts|m4s)(\?|$|\.)/i.test(lower)) return "segment";
  return "other";
}

export function logRequest(
  url: string,
  status: number,
  duration: number,
  options: {
    cached?: boolean;
    rateLimited?: boolean;
    clientIp?: string;
  } = {}
): void {
  const timestamp = Date.now();
  const log: RequestLog = {
    timestamp,
    url,
    host: extractHostname(url),
    type: detectContentType(url),
    status,
    duration,
    cached: options.cached ?? false,
    rateLimited: options.rateLimited ?? false,
    clientIp: options.clientIp,
  };

  requestLog.push(log);
  if (requestLog.length > REQUEST_LOG_SIZE) {
    requestLog.shift();
  }

  // Update client stats
  if (options.clientIp) {
    updateClientStats(options.clientIp, options.rateLimited ?? false);
  }

  // Console logging for debugging
  const typeLabel = log.type.padEnd(8);
  const statusLabel = String(log.status).padEnd(3);
  const cachedLabel = log.cached ? "[CACHE]" : "       ";
  const rateLimitLabel = log.rateLimited ? "[429]" : "     ";
  const durationLabel = `${duration}ms`.padStart(6);
  
  console.log(
    `[PROXY] ${cachedLabel} ${rateLimitLabel} ${typeLabel} ${statusLabel} ${durationLabel} ${log.host}`
  );

  // Warn on rate limiting
  if (log.rateLimited) {
    console.warn(`[PROXY] ⚠️  Rate limited (429) from ${log.host} - URL: ${url.substring(0, 100)}`);
  }
}

function updateClientStats(clientIp: string, rateLimited: boolean): void {
  const now = Date.now();
  let stats = clientStats.get(clientIp);

  if (!stats) {
    stats = {
      ip: clientIp,
      requestCount: 0,
      rateLimitCount: 0,
      lastRequestTime: now,
      windowStart: now,
    };
    clientStats.set(clientIp, stats);
  }

  // Reset window if it's been more than STATS_WINDOW_MS
  if (now - stats.windowStart > STATS_WINDOW_MS) {
    stats.requestCount = 0;
    stats.rateLimitCount = 0;
    stats.windowStart = now;
  }

  stats.requestCount += 1;
  if (rateLimited) stats.rateLimitCount += 1;
  stats.lastRequestTime = now;

  // Warn if client is making too many requests
  if (stats.requestCount > 50) {
    console.warn(
      `[PROXY] ⚠️  Client ${clientIp} made ${stats.requestCount} requests in ${STATS_WINDOW_MS / 1000}s (${stats.rateLimitCount} rate limited)`
    );
  }
}

export function getRequestStats(): {
  totalRequests: number;
  rateLimitedRequests: number;
  cacheHits: number;
  last10Seconds: number;
  byHost: Record<string, { total: number; rateLimited: number }>;
} {
  const now = Date.now();
  const recent = requestLog.filter((log) => now - log.timestamp < 10_000);

  const byHost: Record<string, { total: number; rateLimited: number }> = {};
  let rateLimitedTotal = 0;
  let cacheHits = 0;

  for (const log of requestLog) {
    if (!byHost[log.host]) {
      byHost[log.host] = { total: 0, rateLimited: 0 };
    }
    byHost[log.host].total += 1;
    if (log.rateLimited) {
      byHost[log.host].rateLimited += 1;
      rateLimitedTotal += 1;
    }
    if (log.cached) cacheHits += 1;
  }

  return {
    totalRequests: requestLog.length,
    rateLimitedRequests: rateLimitedTotal,
    cacheHits,
    last10Seconds: recent.length,
    byHost,
  };
}

export function getClientStats(): ClientRequestStats[] {
  return Array.from(clientStats.values());
}

export function clearOldStats(): void {
  const now = Date.now();
  const ips = Array.from(clientStats.keys());
  for (const ip of ips) {
    const stats = clientStats.get(ip)!;
    if (now - stats.lastRequestTime > 60_000) {
      // Remove stats older than 1 minute
      clientStats.delete(ip);
    }
  }
}

// Clean up old stats every minute
setInterval(clearOldStats, 60_000);
