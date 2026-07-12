# Backend comparison — Vidking vs TMDB-native vs scrapers (v4)

> TMDB-native architecture ported from Streamflix `TmdbProvider` (July 2026).

## Three backend tiers

| Tier | Backend | What it does |
|------|---------|--------------|
| **1** | `vidking` | WingsDatabase/Videasy/Oxygen encrypted APIs |
| **2** | `tmdb-native` | TMDB-id → embed API (VixSrc, 2Embed, VidsrcNet, …) — **no scraper layer** |
| **3** | `streamflix` | 27+ HTML scraper providers (SFlix, Ridomovies, …) — optional, LAN-only |

**`backend=auto`** resolves **VixSrc first** (TMDB-native), then appends **Vidking** streams as fallback. Scraper farm excluded for speed.

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
| vidrock | Vidrock | ✓ | ✓ | multi-mirror API |
| vidzee | Vidzee | ✓ | ✓ | 14 servers + AES |
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
| **Primary backend** | **VixSrc** via `backend=auto` or `tmdb-native` (~1.5s, 10/10 coverage in v4) |
| **Fallback** | Vidking when VixSrc missing or user wants multi-quality rungs |
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
