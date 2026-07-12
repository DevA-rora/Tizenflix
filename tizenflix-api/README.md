# Tizenflix API

Netflix-style streaming backend for Tizen/Android TV clients. Resolves [Vidking](https://www.vidking.net/) / Videasy / WingsDatabase streams, **TMDB-native embed APIs** (VixSrc, 2Embed, …), and optional Streamflix scrapers.

Educational purposes only.

## Setup

```bash
npm install          # runs postinstall → playwright install chromium
cp .env.example .env   # add TMDB_API_KEY
npm run setup        # re-install Chromium if postinstall was skipped
```

**Streamflix** (SFlix, Ridomovies, etc.) needs Playwright Chromium for Cloudflare bypass. Skip browser download in CI only: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`.

### Environment

| Variable | Description |
|----------|-------------|
| `TMDB_API_KEY` | Required for catalog/search/browse |
| `PORT` | API port (default `8790`) |
| `PUBLIC_BASE` | Base URL clients use (set LAN IP for TV) |
| `DATA_DIR` | Progress, downloads, job state (default `./data`) |
| `DOH_URL` | DNS-over-HTTPS for Streamflix (default Cloudflare) |
| `STREAMFLIX_REQUIRE_PLAYWRIGHT` | Exit API boot if Chromium missing (`1`) |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | Skip Chromium download on `npm install` (CI) |

## HTTP API

```bash
PUBLIC_BASE=http://192.168.1.10:8790 npm run api
```

### Catalog (TMDB)

| Endpoint | Description |
|----------|-------------|
| `GET /search?q=` | Multi search |
| `GET /title/movie/:tmdbId` | Movie details |
| `GET /title/tv/:tmdbId` | TV show details |
| `GET /title/tv/:tmdbId/seasons` | Season list |
| `GET /title/tv/:tmdbId/:season/episodes` | Episode list |
| `GET /browse/rows` | Home row IDs |
| `GET /browse/row/:id` | Row items (`trending-movies`, `trending-tv`, `popular-movies`, `popular-tv`) |

### Playback

| Endpoint | Description |
|----------|-------------|
| `GET /play/movie/:tmdbId?server=&all=true` | Resolve streams |
| `GET /play/tv/:tmdbId/:season/:episode` | Resolve TV episode |
| `GET /proxy/stream?url=` | Header injection + m3u8 rewrite |
| `GET /providers` | Server list with health stats |
| `POST /play/report` | Report provider success/failure |

### Subtitles

| Endpoint | Description |
|----------|-------------|
| `GET /subtitles/movie/:tmdbId` | Deduped subtitle tracks |
| `GET /subtitles/tv/:tmdbId/:s/:e` | Deduped subtitle tracks |
| `GET /subtitle/:trackId?tmdbId=&type=` | Fetch single VTT track |

### Progress

| Endpoint | Description |
|----------|-------------|
| `POST /progress` | Save watch position |
| `GET /progress/:tmdbId?type=&season=&episode=` | Get position |
| `GET /continue-watching` | Resume list (2–95% watched) |

### Offline download

Requires **ffmpeg** (mux step only). HLS segments are fetched **in parallel** (default 16 concurrent) — much faster than sequential ffmpeg.

| Endpoint | Description |
|----------|-------------|
| `POST /download/movie/:tmdbId` | Start async download job |
| `POST /download/tv/:tmdbId/:s/:e` | Start async download job |
| `GET /download/jobs/:jobId` | Poll job status (segmentsDone/Total) |
| `GET /downloads/:filename` | Download completed file |

Body/query options: `server`, `quality`, `sourceId`, `concurrency` (default 16), `proofSeconds` / `maxDurationSeconds` (cap duration for quick tests).

**POC timings (Inception 27205):** 2-minute clip at 480p ≈ 14s; full 2.5h movie at 480p ≈ 8 min. No direct MP4 sources — all qualities are m3u8 (1080p/720p/480p/4K).

## CLI

```bash
npm run resolve -- movie 27205
npm run download -- movie 27205 -o inception.mp4
npm run capture
```

## Tizen notes

The TV app only talks to your API. Vidking headers are injected server-side. m3u8 playlists are rewritten so every segment goes through `/proxy/stream`. Set `PUBLIC_BASE` to your LAN IP (not `localhost`).

## Tests

```bash
npm test
```

## Benchmarks

```bash
npm run benchmark-tmdb-native   # v4: Vidking vs each TMDB-native source
npm run benchmark-streamflix    # v3: scraper tier (optional)
```

See `docs/streamflix-cutover.md` for interpretation.

## Architecture

```
TMDB (catalog) ──┐
                 ├──► Tizenflix API ──► Vidking (WingsDatabase decrypt)
                 │                   └──► TMDB-native (VixSrc, 2Embed, …)
Progress/downloads (local JSON) ──┘         └──► /proxy/stream ──► CDN
```

## Related

Sibling project [Tizenflix](../Tizenflix) has iframe/postMessage tests.
