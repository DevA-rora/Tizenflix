import type { IptvProvider } from "./types.js";
import {
  createPlutoTvProvider,
  createVavooProvider,
  iptvOrgProvider,
  iptvSpainProvider,
  cineCityProvider,
} from "./providers/m3u-providers.js";
import {
  cableVisionHdProvider,
  tvLibrefutbolProvider,
  tvporinternetHdProvider,
  pelotaLibreTvHdProvider,
} from "./providers/scrape-providers.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../data/streamflix-iptv-providers.json");

const ALL_IPTV_PROVIDERS: IptvProvider[] = [
  createPlutoTvProvider("pluto-tv-us"),
  createPlutoTvProvider("pluto-tv-mx"),
  createPlutoTvProvider("pluto-tv-ar"),
  createPlutoTvProvider("pluto-tv-de"),
  createPlutoTvProvider("pluto-tv-es"),
  createPlutoTvProvider("pluto-tv-fr"),
  createPlutoTvProvider("pluto-tv-it"),
  iptvOrgProvider,
  iptvSpainProvider,
  cineCityProvider,
  cableVisionHdProvider,
  tvLibrefutbolProvider,
  tvporinternetHdProvider,
  pelotaLibreTvHdProvider,
  createVavooProvider("de"),
  createVavooProvider("it"),
  createVavooProvider("fr"),
  createVavooProvider("es"),
  createVavooProvider("pl"),
];

function loadDisabled(): Set<string> {
  if (!existsSync(CONFIG_PATH)) return new Set();
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { disabled?: string[] };
    return new Set(cfg.disabled ?? []);
  } catch {
    return new Set();
  }
}

export function getAllIptvProviders(): IptvProvider[] {
  const disabled = loadDisabled();
  return ALL_IPTV_PROVIDERS.map((p) => ({
    ...p,
    enabled: p.enabled !== false && !disabled.has(p.id),
  }));
}

export function getEnabledIptvProviders(): IptvProvider[] {
  return getAllIptvProviders().filter((p) => p.enabled !== false);
}

export function findIptvProviderById(id: string): IptvProvider | undefined {
  return getAllIptvProviders().find((p) => p.id === id);
}

export function getIptvProviderConfig(): { disabled: string[] } {
  if (!existsSync(CONFIG_PATH)) return { disabled: [] };
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { disabled: string[] };
  } catch {
    return { disabled: [] };
  }
}

export function setIptvProviderEnabled(id: string, enabled: boolean): void {
  const cfg = getIptvProviderConfig();
  const disabled = new Set(cfg.disabled ?? []);
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ disabled: [...disabled] }, null, 2));
}

export function setIptvProviderConfig(disabled: string[]): void {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ disabled }, null, 2));
}
