import dns from "node:dns/promises";

const DEFAULT_DOH_URL =
  process.env.DOH_URL?.trim() || "https://cloudflare-dns.com/dns-query";

const cache = new Map<string, { ips: string[]; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

async function queryDoh(hostname: string, dohUrl: string): Promise<string[]> {
  const url = `${dohUrl}?name=${encodeURIComponent(hostname)}&type=A`;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
  });
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  const json = (await res.json()) as DohResponse;
  if (json.Status !== 0 || !json.Answer?.length) {
    throw new Error(`DoH status ${json.Status} for ${hostname}`);
  }
  return json.Answer.filter((a) => a.type === 1).map((a) => a.data);
}

/** Resolve hostname via DoH with system DNS fallback (mirrors DnsResolver.kt). */
export async function resolveHostname(hostname: string): Promise<string[]> {
  const cached = cache.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.ips;

  if (!DEFAULT_DOH_URL) {
    const ips = await dns.resolve4(hostname);
    return ips;
  }

  try {
    const ips = await queryDoh(hostname, DEFAULT_DOH_URL);
    cache.set(hostname, { ips, expires: Date.now() + CACHE_TTL_MS });
    return ips;
  } catch {
    const ips = await dns.resolve4(hostname);
    cache.set(hostname, { ips, expires: Date.now() + CACHE_TTL_MS });
    return ips;
  }
}

/** Custom lookup for undici Agent — prefers DoH, falls back to system. */
export async function dohLookup(
  hostname: string,
  _options: unknown,
  callback: (err: Error | null, address?: string, family?: number) => void
): Promise<void> {
  try {
    const ips = await resolveHostname(hostname);
    callback(null, ips[0], 4);
  } catch (err) {
    callback(err instanceof Error ? err : new Error(String(err)));
  }
}
