# Backend comparison — Vidking vs TMDB-native vs scrapers (v4)

> **Superseded** by [streamflix-playback.md](./streamflix-playback.md) (July 2026). Kept for historical reference.

> TMDB-native architecture ported from Streamflix `TmdbProvider` (July 2026).

## Three backend tiers

| Tier | Backend | What it does |
|------|---------|--------------|
| **1** | `vidking` | WingsDatabase/Videasy/Oxygen encrypted APIs |
| **2** | `tmdb-native` | TMDB-id → embed API (VixSrc, 2Embed, VidsrcNet, …) — **no scraper layer** |
| **3** | `streamflix` | 27+ HTML scraper providers (SFlix, Ridomovies, …) — optional, LAN-only |

**`backend=auto`** races **6 TMDB-native sources** (priority order below) in parallel with **Vidking**, merges one stream per source, then appends Vidking rungs at priority 1000+. Scraper farm excluded.

### Auto source priority (July 2026)

| Priority | ID | RE notes |
|----------|-----|----------|
| 0 | `vixsrc` | Primary — single HLS master |
| 1 | `twoembed` | StreamWish unpack + Playwright m3u8 fallback |
| 2 | `vidsrcnet` | 11 Playerjs decryptors + Playwright fallback |
| 3 | `vidzee` | AES-GCM api-key (`c4a8f1d7…`) + CBC link decrypt |
| 4 | `vidsrcto` | RC4 keys + Vidplay/Filemoon chain |
| 5 | `vidrock` | Plain `/api/movie/{id}` + AES-GCM URL decrypt |
| 1000+ | Vidking | Multi-quality fallback |

Override list: `GET /play/movie/27205?backend=auto&sources=vixsrc,vidrock`

Smoke probe: `node scripts/run.mjs scripts/probe-extractors.mjs` (requires Playwright for 2Embed/VidsrcNet/Vidsrc.to when embed hosts are slow).

## TMDB-native sources (12 English-global)

| ID | Source | Movie | TV | Notes |
|----|--------|-------|-----|-------|
| vixsrc | VixSrc | ✓ | ✓ | `vixsrc.to/api/movie/{id}` |
| videasy | Videasy | ✓ | ✓ | `duplicateOf: vidking` |
| moviesapi | Moviesapi | ✓ | — | movies only |
| twoembed | 2Embed | ✓ | ✓ | implemented |
| vidsrcnet | Vidsrc.net | ✓ | ✓ | |
| vidlink | VidLink | ✓ | ✓ | Playwright intercept |
| vidsrcru | Vidsrc.Ru | ✓ | ✓ | Playwright intercept |
| vidflix | Vidflix | ✓ | ✓ | API hop |
| vidrock | Vidrock | ✓ | ✓ | `/api/movie/{tmdbId}` + AES-GCM URL decrypt |
| vidzee | Vidzee | ✓ | ✓ | dynamic api-key + AES (static pass rotates — check embed JS) |
| primesrc | PrimeSrc | ✓ | ✓ | multi-mirror API |
| vidsrcto | Vidsrc.to | ✓ | ✓ | keys API |

List: `GET /providers/tmdb-native`

## Setup

```bash
cd tizenflix-api
npm install
npm run setup   # Playwright Chromium (VidLink, VidsrcRu)
```

## Benchmark v4

```bash
npm run benchmark-tmdb-native
```

Outputs:
- `TMDB_NATIVE_BENCHMARK.json`
- `TMDB_NATIVE_BENCHMARK.md`

### What v4 measures

1. **Preflight** — embed host reachability (vixsrc.to, 2embed.cc, …) before title probes
2. **Matrix A** — per title: Vidking vs TMDB-native aggregate
3. **Matrix B** — source × title HLS grid (the fair comparison you wanted)
4. **Matrix C** — Inception per-source error layers (`preflight` / `api_hop` / `extract` / `network`)

### Interpreting results

| Symptom | Meaning |
|---------|---------|
| Preflight `reachable: false` | Network blocks embed host — run from home LAN |
| `layer: api_hop` | TMDB URL built but JSON API failed (e.g. VixSrc `/api/movie`) |
| `layer: extract` | Embed page reached but decrypt/scrape failed |
| Vidking HLS > 0, all TMDB-native 0 | Upstream issue, not missing Chromium |
| VixSrc OK, scrapers fail | Confirms scraper tier is optional |

## API usage

```http
GET /play/movie/27205?backend=tmdb-native&profile=tizen
GET /play/movie/27205?backend=auto
GET /play/tmdb-native/movie/27205
GET /providers/tmdb-native
```

## Recommendation

| Strategy | Verdict |
|----------|---------|
| **Primary backend** | **`backend=auto`** — VixSrc + 5 backups + Vidking |
| **Maintenance** | Re-probe embed JS when decrypt fails (`probe-extractors.mjs`); Vidrock/Vidzee keys live in frontend bundles |
| **Scraper farm** | Optional (`backend=streamflix`) — not for production auto |
| **Other TMDB-native sources** | Fixable with more RE work; benchmark used 12s timeouts + parallel contention |

`backend=auto` resolves **VixSrc first** (recommended source), then appends Vidking streams as fallback.

## Maintenance

| Component | Breakage | Fix |
|-----------|----------|-----|
| Vidking | Player crypto | `npm run capture` |
| VixSrc / embed APIs | API or token format | Update extractor in `extractors/vix-src.ts` |
| VidLink / VidsrcRu | Page JS changes | Playwright intercept patterns |
| Scraper providers | Site HTML | Update provider or disable |
