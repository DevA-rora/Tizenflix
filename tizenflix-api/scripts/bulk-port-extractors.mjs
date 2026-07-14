import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = process.env.STREAMFLIX_REF || "/tmp/streamflix-ref";
const EXTRACTORS_DIR = join(ROOT, "src/streamflix/extractors");
const EXTRACTOR_KT = join(REF, "app/src/main/java/com/streamflixreborn/streamflix/extractors/Extractor.kt");

/** Extractors that use GenericPackedSourceExtractor in Kotlin */
const GENERIC_PACKED = new Set([
  "StreamSBExtractor",
  "Mp4UploadExtractor",
  "StreamlareExtractor",
  "NinjaStreamExtractor",
  "UchExtractor",
  "StreamixExtractor",
  "StreamhubExtractor",
  "StreamrubyExtractor",
  "MaxstreamExtractor",
  "MagaSavorExtractor",
  "MStreamDayExtractor",
  "FsvidExtractor",
  "HxfileExtractor",
  "LamovieExtractor",
  "LoadXExtractor",
  "DroploadExtractor",
  "BigWarpExtractor",
  "PlusPomlaExtractor",
  "PDrrainExtractor",
  "RpmvidExtractor",
  "RidooExtractor",
  "SaveFilesExtractor",
  "ShareCloudyExtractor",
  "StreamUpExtractor",
  "YourUploadExtractor",
  "ZillaExtractor",
  "NuuploadExtractor",
  "OneuploadExtractor",
  "MyFileStorageExtractor",
  "VideoSibNet",
  "VtubeExtractor",
  "ApiVoirFilmExtractor",
]);

/** StreamWish alias extractors */
const STREAMWISH = new Set([
  "StreamWishExtractor.Hlswish",
  "StreamWishExtractor.Playerwish",
  "StreamWishExtractor.SwiftPlayers",
  "StreamWishExtractor.Swish",
  "StreamWishExtractor.UqloadsXyz",
]);

function toKebab(name) {
  return name
    .replace(/Extractor$/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function toCamel(name) {
  const k = toKebab(name);
  return k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function readKotlinMeta(ktPath) {
  if (!existsSync(ktPath)) return { name: "", mainUrl: "", aliasUrls: [] };
  const src = readFileSync(ktPath, "utf8");
  const name = src.match(/override val name\s*=\s*"([^"]+)"/)?.[1] ?? "";
  const mainUrl = src.match(/override val mainUrl\s*=\s*"([^"]+)"/)?.[1] ?? "";
  const aliasBlock = src.match(/override val aliasUrls\s*=\s*listOf\(([\s\S]*?)\)/);
  const aliasUrls = aliasBlock ? [...aliasBlock[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
  return { name, mainUrl, aliasUrls };
}

function parseExtractorEntries(content) {
  const names = [];
  const re = /(\w+Extractor(?:\.\w+)?)\(\)/g;
  let m;
  while ((m = re.exec(content))) names.push(m[1]);
  if (!names.includes("VixcloudExtractor")) names.unshift("VixcloudExtractor");
  return [...new Set(names)];
}

function fileIdFor(classRef) {
  if (classRef.includes(".")) {
    const [outer, inner] = classRef.split(".");
    return `${toKebab(outer)}-${toKebab(inner.replace(/Extractor$/, ""))}`;
  }
  return toKebab(classRef);
}

function generateExtractor(classRef, meta) {
  const fileId = fileIdFor(classRef);
  const exportName = toCamel(fileId) + "Extractor";
  const outer = classRef.split(".")[0];
  const baseClass = classRef.includes(".") ? `${outer}.${classRef.split(".")[1]}` : classRef;

  const aliases = meta.aliasUrls.map((u) => `"${u}"`).join(", ");
  const aliasLine = aliases ? `\n  aliasUrls: [${aliases}],` : "";

  if (GENERIC_PACKED.has(outer) || GENERIC_PACKED.has(classRef)) {
    return `import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from ${classRef} (GenericPackedSourceExtractor) */
export const ${exportName}: ExtractorDef = {
  name: "${meta.name || outer.replace(/Extractor$/, "")}",
  mainUrl: "${meta.mainUrl || "https://example.com"}",${aliasLine}
  extract: (link) => extractGenericPacked(link),
};
`;
  }

  if (STREAMWISH.has(classRef)) {
    return `import type { ExtractorDef } from "../types.js";
import { extractStreamWishPacked } from "./base/streamwish-family.js";

/** Ported from ${classRef} */
export const ${exportName}: ExtractorDef = {
  name: "${meta.name || classRef.split(".")[1]?.replace(/Extractor$/, "") || "StreamWish"}",
  mainUrl: "${meta.mainUrl || "https://streamwish.to"}",${aliasLine}
  extract: (link) => extractStreamWishPacked(link),
};
`;
  }

  if (classRef === "UqloadExtractor") {
    return `import type { ExtractorDef } from "../types.js";
import { extractUqload } from "./base/embed-hosts.js";

export const ${exportName}: ExtractorDef = {
  name: "Uqload",
  mainUrl: "${meta.mainUrl}",
  aliasUrls: [${aliases || '"https://uqload.is"'}],
  extract: extractUqload,
};
`;
  }

  if (classRef === "OkruExtractor") {
    return `import type { ExtractorDef } from "../types.js";
import { extractOkru } from "./base/embed-hosts.js";

export const ${exportName}: ExtractorDef = {
  name: "Okru",
  mainUrl: "${meta.mainUrl}",
  extract: extractOkru,
};
`;
  }

  if (classRef === "SupervideoExtractor") {
    return `import type { ExtractorDef } from "../types.js";
import { extractSupervideo } from "./base/embed-hosts.js";

export const ${exportName}: ExtractorDef = {
  name: "Supervideo",
  mainUrl: "${meta.mainUrl}",
  extract: extractSupervideo,
};
`;
  }

  if (classRef === "DailymotionExtractor") {
    return `import type { ExtractorDef } from "../types.js";
import { extractDailymotion } from "./base/embed-hosts.js";

export const ${exportName}: ExtractorDef = {
  name: "Dailymotion",
  mainUrl: "${meta.mainUrl}",
  extract: extractDailymotion,
};
`;
  }

  if (classRef === "GoogleDriveExtractor") {
    return `import type { ExtractorDef } from "../types.js";
import { extractGoogleDrive } from "./base/embed-hosts.js";

export const ${exportName}: ExtractorDef = {
  name: "Google Drive",
  mainUrl: "${meta.mainUrl}",
  extract: extractGoogleDrive,
};
`;
  }

  if (classRef === "AmazonDriveExtractor") {
    return `import type { ExtractorDef } from "../types.js";
import { extractAmazonDrive } from "./base/embed-hosts.js";

export const ${exportName}: ExtractorDef = {
  name: "Amazon Drive",
  mainUrl: "${meta.mainUrl}",
  extract: extractAmazonDrive,
};
`;
  }

  if (classRef === "OnRegardeOuExtractor") {
    return `import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

export const ${exportName}: ExtractorDef = {
  name: "OnRegardeOu",
  mainUrl: "https://onregardeou.fr",
  extract: (link) => extractGenericPacked(link),
};
`;
  }

  if (classRef === "MixDropExtractor") {
    return `export { mixdropExtractor as ${exportName} } from "../mixdrop.js";
`;
  }

  // Keep existing if already implemented (skip overwrite for hot-path)
  const skip = new Set([
    "VoeExtractor", "VidplayExtractor", "StreamtapeExtractor", "FilemoonExtractor",
    "RabbitstreamExtractor", "TwoEmbedExtractor", "VixSrcExtractor", "VixcloudExtractor",
    "ChillxExtractor", "DoodLaExtractor", "FrembedExtractor", "MoflixExtractor",
    "VidrockExtractor", "VidzeeExtractor", "VidsrcNetExtractor", "VidsrcToExtractor",
    "VidsrcRuExtractor", "VidLinkExtractor", "VidflixExtractor", "VideasyExtractor",
    "PrimeSrcExtractor", "MoviesapiExtractor", "NekostreamExtractor", "CloseloadExtractor",
    "VidGuardExtractor", "EinschaltenExtractor", "AfterDarkExtractor", "GoodstreamExtractor",
    "MixDropExtractor", "StreamWishExtractor",
  ]);
  if (skip.has(classRef) || skip.has(outer)) {
    return "";
  }

  return `import type { ExtractorDef } from "../types.js";
import { extractGenericPacked } from "./base/generic-packed.js";

/** Ported from ${classRef} — fallback generic packed */
export const ${exportName}: ExtractorDef = {
  name: "${meta.name || outer.replace(/Extractor$/, "")}",
  mainUrl: "${meta.mainUrl || "https://example.com"}",${aliasLine}
  extract: (link) => extractGenericPacked(link),
};
`;
}

const extractorKt = readFileSync(EXTRACTOR_KT, "utf8");
const classRefs = parseExtractorEntries(extractorKt);
let updated = 0;
let skipped = 0;

for (const ref of classRefs) {
  const outer = ref.split(".")[0];
  const ktFile = join(REF, `app/src/main/java/com/streamflixreborn/streamflix/extractors/${outer}.kt`);
  const meta = readKotlinMeta(ktFile);
  const content = generateExtractor(ref, meta);
  if (!content) {
    skipped++;
    continue;
  }
  const fileId = fileIdFor(ref);
  const out = join(EXTRACTORS_DIR, `${fileId}.ts`);
  writeFileSync(out, content);
  updated++;
}

// Add missing extractors not in registry
const onRegarde = join(EXTRACTORS_DIR, "on-regarde-ou.ts");
if (!existsSync(onRegarde)) {
  writeFileSync(onRegarde, generateExtractor("OnRegardeOuExtractor", { name: "OnRegardeOu", mainUrl: "https://onregardeou.fr", aliasUrls: [] }));
  updated++;
}

console.log(`Updated ${updated} extractors, skipped ${skipped} (already implemented)`);
