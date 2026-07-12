#!/usr/bin/env node
/**
 * Generate TypeScript provider/extractor skeletons from Streamflix Kotlin reference.
 * Usage: node scripts/port-from-kotlin.mjs [--providers] [--extractors] [--registry]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = process.env.STREAMFLIX_REF || "/tmp/streamflix-ref";
const PROVIDERS_DIR = join(ROOT, "src/streamflix/providers");
const EXTRACTORS_DIR = join(ROOT, "src/streamflix/extractors");
const PROVIDER_KT = join(REF, "app/src/main/java/com/streamflixreborn/streamflix/providers/Provider.kt");
const EXTRACTOR_KT = join(REF, "app/src/main/java/com/streamflixreborn/streamflix/extractors/Extractor.kt");

const args = new Set(process.argv.slice(2));
const doAll = args.size === 0;
const doProviders = doAll || args.has("--providers");
const doExtractors = doAll || args.has("--extractors");
const doRegistry = doAll || args.has("--registry");

function toKebab(name) {
  return name
    .replace(/Provider$/, "")
    .replace(/Extractor$/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function toCamel(name) {
  const k = toKebab(name);
  return k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function parseProviderEntries(content) {
  const entries = [];
  const re = /(\w+Provider(?:\([^)]*\))?)\s+to\s+ProviderSupport\(movies\s*=\s*(true|false),\s*tvShows\s*=\s*(true|false)\)/g;
  let m;
  while ((m = re.exec(content))) {
    const raw = m[1];
    const langMatch = raw.match(/Provider\("(\w+)"\)/);
    const className = raw.replace(/\(.*\)/, "");
    const fileBase = raw.includes('("en")')
      ? "streaming-community-en"
      : raw.includes('("it")')
        ? "streaming-community-it"
        : raw.match(/VavooProvider\("(\w+)"\)/)
          ? `vavoo-${raw.match(/VavooProvider\("(\w+)"\)/)[1]}`
          : toKebab(className);
    entries.push({
      className,
      fileBase,
      movies: m[2] === "true",
      tvShows: m[3] === "true",
      lang: langMatch?.[1] ?? null,
      raw,
    });
  }
  return entries;
}

function parseExtractorEntries(content) {
  const names = [];
  const re = /(\w+Extractor(?:\.\w+)?)\(\)/g;
  let m;
  while ((m = re.exec(content))) {
    names.push(m[1]);
  }
  if (!names.some((n) => n === "VixcloudExtractor")) {
    names.unshift("VixcloudExtractor");
  }
  return [...new Set(names)];
}

function readKotlinMeta(ktPath) {
  if (!existsSync(ktPath)) return { mainUrl: "", aliasUrls: [], name: "" };
  const src = readFileSync(ktPath, "utf8");
  const name = src.match(/override val name\s*=\s*"([^"]+)"/)?.[1] ?? "";
  const mainUrl = src.match(/override val mainUrl\s*=\s*"([^"]+)"/)?.[1] ?? "";
  const aliasBlock = src.match(/override val aliasUrls\s*=\s*listOf\(([\s\S]*?)\)/);
  const aliasUrls = aliasBlock
    ? [...aliasBlock[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
    : [];
  return { name, mainUrl, aliasUrls };
}

function providerStub(entry) {
  const id = entry.fileBase;
  const exportName = toCamel(id) + "Provider";
  return `import type { ContentProvider, ProviderMatch } from "./types.js";
import type { ExtractedVideo, StreamServer } from "../types.js";
import { stubGetServers, stubGetVideo, stubFindByTmdb } from "./base.js";

/** Auto-generated from ${entry.className} — fill in TMDB/search logic. */
export const ${exportName}: ContentProvider = {
  id: "${id}",
  name: "${entry.className.replace(/Provider$/, "")}",
  language: "${entry.lang ?? "en"}",
  supportsMovies: ${entry.movies},
  supportsTv: ${entry.tvShows},
  enabled: false,
  findByTmdb: stubFindByTmdb("${entry.className.replace(/Provider$/, "")}"),
  getServers: stubGetServers,
  getVideo: stubGetVideo,
};
`;
}

function extractorStub(classRef) {
  const isNested = classRef.includes(".");
  const [outer, inner] = isNested ? classRef.split(".") : [classRef, null];
  const ktFile = join(REF, `app/src/main/java/com/streamflixreborn/streamflix/extractors/${outer}.kt`);
  const meta = readKotlinMeta(ktFile);
  const fileId = inner
    ? `${toKebab(outer)}-${toKebab(inner.replace(/Extractor$/, ""))}`
    : toKebab(outer);
  const exportName = toCamel(fileId) + "Extractor";
  const displayName = inner ? `${meta.name || inner.replace(/Extractor$/, "")}` : meta.name || outer.replace(/Extractor$/, "");
  const aliases = meta.aliasUrls.map((u) => `"${u}"`).join(", ");

  return {
    fileId,
    exportName,
    content: `import type { ExtractedVideo } from "../types.js";
import type { ExtractorDef } from "../types.js";
import { notImplementedExtract } from "./base/not-implemented.js";

/** Auto-generated from ${classRef} */
export const ${exportName}: ExtractorDef = {
  name: "${displayName}",
  mainUrl: "${meta.mainUrl || "https://example.com"}",
  ${aliases ? `aliasUrls: [${aliases}],` : ""}
  extract: notImplementedExtract("${displayName}"),
};
`,
  };
}

function writeProviderRegistry(entries) {
  const imports = entries
    .map((e) => `import { ${toCamel(e.fileBase)}Provider } from "./${e.fileBase}.js";`)
    .join("\n");
  const list = entries.map((e) => `  ${toCamel(e.fileBase)}Provider,`).join("\n");
  const content = `${imports}
import type { ContentProvider } from "./types.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../data/streamflix-providers.json");

const ALL_PROVIDERS: ContentProvider[] = [
${list}
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

export function getAllProviders(): ContentProvider[] {
  const disabled = loadDisabled();
  return ALL_PROVIDERS.map((p) => ({
    ...p,
    enabled: p.enabled !== false && !disabled.has(p.id),
  }));
}

export function getEnabledProviders(type: "movie" | "tv"): ContentProvider[] {
  return getAllProviders().filter((p) => {
    if (!p.enabled) return false;
    return type === "movie" ? p.supportsMovies : p.supportsTv;
  });
}

export function findProviderById(id: string): ContentProvider | undefined {
  return getAllProviders().find((p) => p.id === id);
}
`;
  writeFileSync(join(PROVIDERS_DIR, "registry.ts"), content);
}

function writeExtractorRegistry(stubs) {
  const imports = stubs.map((s) => `import { ${s.exportName} } from "./${s.fileId}.js";`).join("\n");
  const list = stubs.map((s) => `  ${s.exportName},`).join("\n");
  const content = `import type { ExtractedVideo, ExtractorDef } from "../types.js";
import { fetchText } from "../http.js";
import { BROWSER_UA } from "../http.js";
${imports}

const EXTRACTORS: ExtractorDef[] = [
${list}
];

const URL_PREFIX_RE = /^(https?:\\/\\/)?(www\\.)?/i;

function normalizeCompareUrl(link: string): string {
  return link.toLowerCase().replace(URL_PREFIX_RE, "");
}

function stripDomain(url: string): string {
  return url.replace(/^(https?:\\/\\/)?(www\\.)?(.*?)(\\.[a-z]+)/i, "$3");
}

async function resolveBridge(link: string): Promise<string> {
  if (!link.includes("mysync.mov/stream/")) return link;
  try {
    const html = await fetchText(link, { headers: { "User-Agent": BROWSER_UA } });
    const patterns = [
      /window\\.location\\.replace\\("([^"]+)"/,
      /window\\.location\\.href\\s*=\\s*"([^"]+)"/,
      /src="(https?:\\/\\/[^"]+)"/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]?.startsWith("http")) return m[1];
    }
  } catch { /* fall through */ }
  return link;
}

export async function extractVideo(link: string, serverName?: string): Promise<ExtractedVideo> {
  let finalLink = await resolveBridge(link);
  const compareUrl = normalizeCompareUrl(finalLink);
  let found: ExtractorDef | null = null;

  for (const ext of EXTRACTORS) {
    if (compareUrl.startsWith(normalizeCompareUrl(ext.mainUrl))) { found = ext; break; }
    for (const alias of ext.aliasUrls ?? []) {
      if (compareUrl.startsWith(normalizeCompareUrl(alias))) { found = ext; break; }
    }
    if (found) break;
  }

  if (!found) {
    for (const ext of EXTRACTORS) {
      if (compareUrl.startsWith(stripDomain(ext.mainUrl).toLowerCase())) { found = ext; break; }
      for (const alias of ext.aliasUrls ?? []) {
        if (compareUrl.startsWith(stripDomain(alias).toLowerCase())) { found = ext; break; }
      }
      if (found) break;
    }
  }

  if (!found && serverName) {
    const lower = serverName.toLowerCase();
    found = EXTRACTORS.find((e) => lower.includes(e.name.toLowerCase())) ?? null;
  }

  if (!found) throw new Error(\`No extractor found for URL: \${finalLink}\`);
  return found.extract(finalLink, serverName);
}

export function listExtractors(): string[] {
  return EXTRACTORS.map((e) => e.name);
}

export function getExtractorRegistry(): ExtractorDef[] {
  return EXTRACTORS;
}
`;
  writeFileSync(join(EXTRACTORS_DIR, "registry.ts"), content);
}

mkdirSync(PROVIDERS_DIR, { recursive: true });
mkdirSync(join(EXTRACTORS_DIR, "base"), { recursive: true });

if (doProviders) {
  const providerKt = readFileSync(PROVIDER_KT, "utf8");
  const entries = parseProviderEntries(providerKt);
  for (const entry of entries) {
    const out = join(PROVIDERS_DIR, `${entry.fileBase}.ts`);
    if (!existsSync(out) || out.includes("Auto-generated")) {
      writeFileSync(out, providerStub(entry));
    }
  }
  console.log(`Providers: ${entries.length} entries`);
  if (doRegistry) writeProviderRegistry(entries);
}

if (doExtractors) {
  const extractorKt = readFileSync(EXTRACTOR_KT, "utf8");
  const classRefs = parseExtractorEntries(extractorKt);
  const stubs = [];
  for (const ref of classRefs) {
    const { fileId, exportName, content } = extractorStub(ref);
    const out = join(EXTRACTORS_DIR, `${fileId}.ts`);
    stubs.push({ fileId, exportName });
    if (!existsSync(out)) {
      writeFileSync(out, content);
    }
  }
  console.log(`Extractors: ${stubs.length} entries`);
  if (doRegistry) writeExtractorRegistry(stubs);
}

console.log("Done.");
