#!/usr/bin/env tsx
/** Compare Streamflix Kotlin registry vs Tizenflix provider implementation status. */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAllProviders } from "../src/streamflix/providers/registry.js";
import { getAllIptvProviders } from "../src/streamflix/iptv/registry.js";
import { readdirSync } from "node:fs";

const REF = process.env.STREAMFLIX_REF || "/tmp/streamflix-ref";
const PROVIDER_KT = join(REF, "app/src/main/java/com/streamflixreborn/streamflix/providers/Provider.kt");
const EXTRACTORS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/streamflix/extractors");

function countExtractors() {
  const files = readdirSync(EXTRACTORS_DIR).filter(
    (f) => f.endsWith(".ts") && f !== "registry.ts" && f !== "voe-decrypt.ts" && f !== "vix-src-playlist.ts"
  );
  let implemented = 0;
  let stubs = 0;
  for (const f of files) {
    const src = readFileSync(join(EXTRACTORS_DIR, f), "utf8");
    if (src.includes("notImplementedExtract")) stubs++;
    else implemented++;
  }
  return { total: files.length, implemented, stubs };
}

function main() {
  const vod = getAllProviders();
  const iptv = getAllIptvProviders();
  const ext = countExtractors();

  const full = vod.filter((p) => p.implementationStatus === "full" || !p.implementationStatus);
  const partial = vod.filter((p) => p.implementationStatus === "partial");
  const stub = vod.filter((p) => p.implementationStatus === "stub" || p.enabled === false);

  console.log("# Streamflix Provider Coverage\n");
  console.log("| Layer | Total | Full | Partial | Stub/Disabled |");
  console.log("|-------|-------|------|---------|---------------|");
  console.log(`| VOD providers | ${vod.length} | ${full.length} | ${partial.length} | ${stub.length} |`);
  console.log(`| IPTV providers | ${iptv.length} | ${iptv.length} | 0 | 0 |`);
  console.log(`| Extractors | ${ext.total} | ${ext.implemented} | — | ${ext.stubs} |`);
  console.log("");

  if (existsSync(PROVIDER_KT)) {
    const kt = readFileSync(PROVIDER_KT, "utf8");
    const ktCount = (kt.match(/Provider(?:\([^)]*\))?\s+to\s+ProviderSupport/g) || []).length;
    console.log(`Kotlin registry entries: ${ktCount}`);
    console.log(`Tizenflix VOD + IPTV: ${vod.length + iptv.length}`);
  } else {
    console.log("Set STREAMFLIX_REF=/path/to/streamflix-ref to compare with Kotlin registry.");
  }

  console.log("\n## VOD Providers\n");
  for (const p of vod) {
    const status = p.implementationStatus ?? (p.enabled === false ? "stub" : "full");
    console.log(`- ${p.id} (${p.name}) — ${status}`);
  }

  console.log("\n## IPTV Providers\n");
  for (const p of iptv) {
    console.log(`- ${p.id} (${p.name}) — full`);
  }
}

main();
