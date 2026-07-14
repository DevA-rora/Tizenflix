/** M3U playlist parsing — port of Streamflix IPTV providers (PlutoTv*, IptvOrg, etc.) */

export interface M3uChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  userAgent?: string;
  referrer?: string;
}

export function parseM3u(raw: string): M3uChannel[] {
  const channels: M3uChannel[] = [];
  let curName = "";
  let curLogo = "";
  let curGroup = "";
  let curUA: string | undefined;
  let curRef: string | undefined;

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("#EXTINF")) {
      curName = t.slice(t.lastIndexOf(",") + 1).trim();
      curLogo = t.match(/tvg-logo="([^"]+)"/)?.[1] ?? "";
      curGroup = t.match(/group-title="([^"]+)"/)?.[1] ?? "";
      curUA = t.match(/http-user-agent="([^"]+)"/)?.[1];
      curRef = t.match(/http-referrer="([^"]+)"/)?.[1];
    } else if (t.startsWith("#EXTVLCOPT:")) {
      if (t.includes("http-user-agent=")) curUA = t.split("http-user-agent=")[1]?.trim();
      if (t.includes("http-referrer=")) curRef = t.split("http-referrer=")[1]?.trim();
    } else if (t.startsWith("http")) {
      if (curName) {
        channels.push({
          name: curName,
          url: t,
          logo: curLogo || undefined,
          group: curGroup || undefined,
          userAgent: curUA,
          referrer: curRef,
        });
        curName = "";
        curLogo = "";
        curGroup = "";
        curUA = undefined;
        curRef = undefined;
      }
    }
  }
  return channels;
}

export function encodeChannelId(channel: M3uChannel): string {
  const raw = `${channel.url}|${channel.name}|${channel.logo ?? ""}|${channel.userAgent ?? ""}|${channel.referrer ?? ""}`;
  return Buffer.from(raw, "utf8").toString("base64");
}

export function decodeChannelId(id: string): M3uChannel {
  try {
    const decoded = Buffer.from(id, "base64").toString("utf8");
    const parts = decoded.split("|");
    return {
      url: parts[0] ?? id,
      name: parts[1] ?? "Unknown",
      logo: parts[2] || undefined,
      userAgent: parts[3] || undefined,
      referrer: parts[4] || undefined,
    };
  } catch {
    return { url: id, name: "Unknown" };
  }
}
