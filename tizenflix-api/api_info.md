# Tizenflix API — Comprehensive Reference & App Development Guide

> **Purpose of this document:** Everything discovered during reverse-engineering Vidking/Videasy/WingsDatabase and building the Netflix-style `tizenflix-api`. Use this when wiring UI clients (Tizen, Android TV, macOS, etc.) and when deciding what belongs in the API vs. your application layer (e.g. Appwrite).

**Educational / personal use only.** This stack depends on third-party streaming infrastructure with no SLA.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [What this API is (and is not)](#2-what-this-api-is-and-is-not)
3. [Architecture](#3-architecture)
4. [Upstream dependencies](#4-upstream-dependencies)
5. [Stream resolution pipeline](#5-stream-resolution-pipeline)
6. [Environment & deployment](#6-environment--deployment)
7. [Full API reference](#7-full-api-reference)
8. [Response shapes](#8-response-shapes)
9. [Playback integration](#9-playback-integration)
10. [Subtitles](#10-subtitles)
11. [Offline downloads](#11-offline-downloads)
12. [Progress & continue watching](#12-progress--continue-watching)
13. [Provider health & server switching](#13-provider-health--server-switching)
14. [Proxy layer (critical for TV)](#14-proxy-layer-critical-for-tv)
15. [Appwrite & application-layer integration](#15-appwrite--application-layer-integration)
16. [Platform notes (Tizen, Android, macOS)](#16-platform-notes-tizen-android-macos)
17. [App development checklist](#17-app-development-checklist)
18. [Resilience & fragility analysis](#18-resilience--fragility-analysis)
19. [Performance & bottlenecks](#19-performance--bottlenecks)
20. [Operational maintenance](#20-operational-maintenance)
21. [CLI tools](#21-cli-tools)
22. [Verified test results](#22-verified-test-results)
23. [Known limitations](#23-known-limitations)
24. [Example end-to-end flows](#24-example-end-to-end-flows)

---



## 1. Executive summary

**Yes — you have a workable API you can plug a UI into today.**


| Capability                   | Status | Notes                                                 |
| ---------------------------- | ------ | ----------------------------------------------------- |
| Browse / search catalog      | ✅      | TMDB-backed; needs `TMDB_API_KEY`                     |
| Resolve playable streams     | ✅      | Movie + TV, multi-server fallback                     |
| Stream proxy for TV clients  | ✅      | Headers + m3u8 segment rewrite                        |
| Subtitles                    | ✅      | From upstream; deduped; **no OpenSubtitles required** |
| Watch progress (local)       | ✅      | JSON file; use Appwrite for multi-device              |
| Offline download jobs        | ✅      | Parallel HLS + ffmpeg mux; needs ffmpeg on host       |
| Provider health              | ✅      | Report + stats on `/providers`                        |
| User accounts / auth         | ❌      | App layer (Appwrite recommended)                      |
| Watchlists / recommendations | ❌      | App layer                                             |


**Split of responsibility:**

- `tizenflix-api` → streams, proxy, catalog proxy, downloads, optional local progress
- **Your apps + Appwrite** → auth, profiles, synced progress, lists, UI, error UX

---



## 2. What this API is (and is not)



### What it is

A **self-hosted HTTP backend** that:

1. Resolves TMDB IDs to direct `.m3u8` (and occasionally `.mp4`) stream URLs via the same internal pipeline Vidking's embed player uses.
2. Proxies those streams so TV/browser clients never talk to CDN hosts directly (required headers + m3u8 rewrite).
3. Exposes Netflix-style REST endpoints for catalog, play, subtitles, progress, and downloads.



### What it is not

- Not a hosted Netflix clone with licensed content hosting.
- Not a stable public API with versioning guarantees from Vidking/Videasy.
- Not a user database — progress is local JSON unless you sync via Appwrite.
- Not a substitute for TMDB — catalog routes proxy TMDB v3.



### Original Vidking public API

Vidking's **documented** API is iframe-only:

- Movies: `https://www.vidking.net/embed/movie/{tmdbId}`
- TV: `https://www.vidking.net/embed/tv/{tmdbId}/{season}/{episode}`

This project implements the **undocumented internal** WingsDatabase pipeline found in `VideoPlayer-CfmbsjlB.js`.

---



## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR CLIENT APPS                          │
│         (Tizen TV / Android TV / macOS / mobile)               │
└────────────┬───────────────────────────────┬────────────────────┘
             │ HTTP REST                      │ HTTP REST
             ▼                                ▼
┌────────────────────────┐         ┌─────────────────────────────┐
│    tizenflix-api       │         │       Appwrite (optional)    │
│  • resolve / play      │         │  • auth / profiles           │
│  • proxy / download    │         │  • watchlists / favorites    │
│  • catalog (TMDB)      │         │  • cross-device progress     │
│  • local progress JSON │         │  • download metadata         │
└────────────┬───────────┘         └─────────────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌─────────┐    ┌──────────────────────────────────┐
│  TMDB   │    │  WingsDatabase / Videasy upstream   │
│  v3 API │    │  • db.wingsdatabase.com (metadata)  │
└─────────┘    │  • api.wingsdatabase.com (seed)     │
               │  • api.wingsdatabase.com/{server}/   │
               │    sources-with-title (encrypted)    │
               └──────────────┬───────────────────────┘
                              ▼
               ┌──────────────────────────────────┐
               │  CDN hosts (rotating domains)     │
               │  moon.ironbubble.site, etc.       │
               └──────────────────────────────────┘
```



### Project layout

```
tizenflix-api/
├── src/
│   ├── api/           # metadata, seed, sources fetch
│   ├── crypto/        # decrypt (mvm1, enc=2)
│   ├── constants/     # servers, headers
│   ├── normalize/     # play response, subtitle dedupe
│   ├── proxy/         # m3u8 rewrite, upstream fetch
│   ├── download/      # parallel HLS jobs
│   ├── tmdb/          # catalog client
│   ├── store/         # progress, provider health (JSON)
│   └── server/        # route registration
├── scripts/           # server.mjs, resolve, download, capture
├── data/              # progress.json, downloads/, job state (gitignored)
├── tests/
├── api_info.md        # ← this file
└── README.md
```

---



## 4. Upstream dependencies



### Pinned player bundle


| Asset  | URL                                                      |
| ------ | -------------------------------------------------------- |
| Main   | `https://www.vidking.net/assets/index-2YwSkQks.js`       |
| Player | `https://www.vidking.net/assets/VideoPlayer-CfmbsjlB.js` |


Re-run `npm run capture` after Vidking deploys to detect API/crypto changes.

### Discovered WingsDatabase endpoints


| Step     | URL                                                                                      |
| -------- | ---------------------------------------------------------------------------------------- |
| Metadata | `GET https://db.wingsdatabase.com/3/{movie|tv}/{tmdbId}?append_to_response=external_ids` |
| Seed     | `GET https://api.wingsdatabase.com/seed?mediaId={tmdbId}`                                |
| Sources  | `GET https://api.wingsdatabase.com/{server}/sources-with-title?...&enc=2&seed=...`       |




### Stream providers (servers)


| Name         | API endpoint suffix              | Notes                                       |
| ------------ | -------------------------------- | ------------------------------------------- |
| **Hydrogen** | `cdn/sources-with-title`         | Default first; often has 1080p/720p/480p/4K |
| **Titanium** | `tejo/sources-with-title`        | Fallback                                    |
| **Oxygen**   | `neon2/sources-with-title`       | Fallback                                    |
| **Lithium**  | `downloader2/sources-with-title` | Fallback                                    |
| **Helium**   | `1movies/sources-with-title`     | Fallback                                    |


Try order: Hydrogen → Titanium → Oxygen → Lithium → Helium.

### Required request headers

Upstream requests **fail without** Vidking-mimicking headers (seed returns 403):

```
Origin: https://www.vidking.net
Referer: https://www.vidking.net/
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...
Accept: */*
```

The API injects these server-side. **Clients should never call CDN URLs directly.**

### Encryption

- Version: `enc=2`
- Magic header: `mvm1` (bytes `[109, 118, 109, 49]`)
- Key material: XOR of `seed` + `tmdbId`
- Implementation: `src/crypto/decrypt.ts` (ported from player JS)



### Subtitle upstream

Subtitles arrive **inside the decrypted sources response** — same pipeline as video. URLs often point to Videasy subtitle hosts (e.g. `subs.videasy.to`). **OpenSubtitles is optional** — only needed if you want fallback/community subs.

---



## 5. Stream resolution pipeline

Public Videasy docs only cover iframe embeds (`player.videasy.net` / `player.videasy.to`). This API does **not** embed those iframes — it resolves direct `.m3u8` / `.mp4` URLs from WingsDatabase using the **Videasy player identity** (`Origin`/`Referer: https://player.videasy.to/`), then proxies them.

`backend=auto` order:

1. **Videasy** CDN (Neon, Yoru, Tejo, …)
2. **VixSrc**
3. **Streamflix** scrapers
4. Other TMDB-native embeds
5. **Vidking** CDN (last resort)

```
TMDB ID
  → fetchMetadata (title, year, imdbId)
  → fetchSeed (cached ~30s TTL, Videasy or Vidking headers)
  → fetch encrypted sources per server
  → decryptAndParse (mvm1)
  → normalize sources (mp4/m3u8) + dedupe subtitles
  → merge multi-server results (if all=true)
  → wrap URLs through /proxy/stream
  → PlayResponse JSON
```

**Resolve is fast (< 1 second).** Do not cache resolved URLs for long — CDN tokens expire.

---



## 6. Environment & deployment



### `.env` variables


| Variable       | Required       | Default                   | Description                               |
| -------------- | -------------- | ------------------------- | ----------------------------------------- |
| `TMDB_API_KEY` | For catalog    | —                         | TMDB v3 API key                           |
| `PORT`         | No             | `8790`                    | HTTP listen port                          |
| `PUBLIC_BASE`  | **Yes for TV** | `http://localhost:{PORT}` | Base URL **clients** use for proxied URLs |
| `DATA_DIR`     | No             | `./data`                  | Progress, downloads, job state            |




### Start the server

```bash
npm install
cp .env.example .env   # add TMDB_API_KEY
npm run api
# or:
PUBLIC_BASE=http://192.168.1.10:8790 npm run api
```

`npm run api` compiles TypeScript with `tsc` then starts the server with plain `node` (works on Linux and macOS without `tsx`).

### TV / LAN deployment checklist

- [ ] Set `PUBLIC_BASE` to your machine's **LAN IP**, not `localhost`
- [ ] Ensure TV and API host are on the same network (or port-forward)
- [ ] Open firewall port (default 8790)
- [ ] Install **ffmpeg** on API host if using downloads
- [ ] Set `TMDB_API_KEY` for browse/search



### Data directory (`DATA_DIR`)


| Path                        | Contents                       |
| --------------------------- | ------------------------------ |
| `data/progress.json`        | Watch progress entries         |
| `data/provider-health.json` | Provider success/failure stats |
| `data/download-jobs.json`   | Async download job state       |
| `data/downloads/`           | Completed MP4 files            |


---



## 7. Full API reference

Base URL: `{PUBLIC_BASE}` (e.g. `http://192.168.1.10:8790`)

### Index & health


| Method | Path      | Description                         |
| ------ | --------- | ----------------------------------- |
| `GET`  | `/`       | Service index + endpoint list       |
| `GET`  | `/health` | `{ ok: true, service, publicBase }` |


---



### Catalog (requires `TMDB_API_KEY`)

Returns **503** if `TMDB_API_KEY` is not set.


| Method | Path                                 | Query       | Description                |
| ------ | ------------------------------------ | ----------- | -------------------------- |
| `GET`  | `/search`                            | `q`, `page` | Multi search (movies + TV) |
| `GET`  | `/title/movie/:tmdbId`               | —           | Movie details              |
| `GET`  | `/title/tv/:tmdbId`                  | —           | TV show details            |
| `GET`  | `/title/tv/:tmdbId/seasons`          | —           | Season list                |
| `GET`  | `/title/tv/:tmdbId/:season/episodes` | —           | Episode list               |
| `GET`  | `/browse/rows`                       | —           | Home row definitions       |
| `GET`  | `/browse/row/:id`                    | `page`      | Row items                  |


**Browse row IDs:** `trending-movies`, `trending-tv`, `popular-movies`, `popular-tv`

**Catalog item shape:**

```json
{
  "id": "27205",
  "type": "movie",
  "title": "Inception",
  "year": 2010,
  "overview": "...",
  "poster": "https://image.tmdb.org/t/p/w500/...",
  "backdrop": "https://image.tmdb.org/t/p/w1280/...",
  "rating": 8.4,
  "runtime": 148
}
```

---



### Playback


| Method | Path                                | Query           | Description                     |
| ------ | ----------------------------------- | --------------- | ------------------------------- |
| `GET`  | `/play/movie/:tmdbId`               | `server`, `all` | Resolve movie streams           |
| `GET`  | `/play/tv/:tmdbId/:season/:episode` | `server`, `all` | Resolve TV episode              |
| `GET`  | `/proxy/stream`                     | `url`           | Proxy + m3u8 rewrite            |
| `GET`  | `/providers`                        | —               | Server list + health            |
| `POST` | `/play/report`                      | body            | Report provider success/failure |


**Query params:**

- `server` — force a specific provider (e.g. `Oxygen`)
- `all=true` — return sources from all servers that respond (slower)

**Example:**

```http
GET /play/movie/27205
GET /play/movie/27205?server=Oxygen
GET /play/tv/1396/1/1
```

---



### Subtitles


| Method | Path                          | Query                                           | Description             |
| ------ | ----------------------------- | ----------------------------------------------- | ----------------------- |
| `GET`  | `/subtitles/movie/:tmdbId`    | `server`                                        | Deduped subtitle tracks |
| `GET`  | `/subtitles/tv/:tmdbId/:s/:e` | `server`                                        | Deduped subtitle tracks |
| `GET`  | `/subtitle/:trackId`          | `tmdbId`, `type`, `season`, `episode`, `server` | Single track body (VTT) |


Subtitles are also included in `/play` responses (already proxied).

---



### Progress (local JSON store)


| Method | Path                 | Description         |
| ------ | -------------------- | ------------------- |
| `POST` | `/progress`          | Save watch position |
| `GET`  | `/progress/:tmdbId`  | Get position        |
| `GET`  | `/continue-watching` | Resume list         |


**POST** `/progress` **body:**

```json
{
  "tmdbId": "27205",
  "type": "movie",
  "positionSeconds": 3600,
  "durationSeconds": 8888,
  "title": "Inception",
  "poster": "https://image.tmdb.org/..."
}
```

For TV, include `"season": 1, "episode": 3`.

**Continue watching** returns items where `2% < percent < 95%`, sorted by `updatedAt`.

> **For production apps:** sync progress to **Appwrite** for multi-device. The API progress store is a simple local fallback / dev tool.

---



### Offline downloads

Requires **ffmpeg** on the API host (mux only).


| Method | Path                         | Description             |
| ------ | ---------------------------- | ----------------------- |
| `POST` | `/download/movie/:tmdbId`    | Start async download    |
| `POST` | `/download/tv/:tmdbId/:s/:e` | Start async download    |
| `GET`  | `/download/jobs/:jobId`      | Poll job status         |
| `GET`  | `/download/jobs`             | List recent jobs        |
| `GET`  | `/downloads/:filename`       | Download completed file |


**POST body options:**

```json
{
  "quality": "1080p",
  "server": "Hydrogen",
  "sourceId": "hydrogen-1080p-0",
  "concurrency": 16,
  "proofSeconds": 120,
  "maxDurationSeconds": 120
}
```


| Field                                 | Description                                              |
| ------------------------------------- | -------------------------------------------------------- |
| `quality`                             | Filter source label (e.g. `1080p`, `720p`, `480p`, `4K`) |
| `server`                              | Force provider                                           |
| `sourceId`                            | Exact source from play response                          |
| `concurrency`                         | Parallel segment fetches (default 16)                    |
| `proofSeconds` / `maxDurationSeconds` | Cap duration for quick proofs                            |


**Response (202):**

```json
{
  "job": { "id": "...", "status": "queued", ... },
  "statusUrl": "http://192.168.1.10:8790/download/jobs/{id}"
}
```

**Job statuses:** `queued` → `downloading` → `muxing` → `completed` | `failed`

---



## 8. Response shapes



### PlayResponse

```json
{
  "title": "Inception",
  "type": "movie",
  "tmdbId": "27205",
  "sources": [
    {
      "id": "hydrogen-1080p-0",
      "provider": "Hydrogen",
      "label": "1080p",
      "type": "m3u8",
      "url": "http://192.168.1.10:8790/proxy/stream?url=https%3A%2F%2F...",
      "priority": 0
    }
  ],
  "recommended": "hydrogen-1080p-0",
  "subtitles": [
    {
      "id": "sub-english-0",
      "language": "english",
      "label": "English",
      "url": "http://192.168.1.10:8790/proxy/stream?url=...",
      "default": true
    }
  ],
  "nextEpisode": null
}
```

TV responses include `season`, `episode`, and `nextEpisode: { season, episode }`.

### Source selection in your app

1. Use `recommended` source ID, or
2. Let user pick quality → match `label`, or
3. Use `?server=` query when resolving

**Prefer** `type: "mp4"` **when available** (rare) — single-file download is much faster than HLS.

### DownloadJob

```json
{
  "id": "uuid",
  "status": "downloading",
  "type": "movie",
  "tmdbId": "27205",
  "title": "Inception",
  "provider": "Hydrogen",
  "quality": "480p",
  "streamType": "m3u8",
  "outputFile": "movie-27205-inception.mp4",
  "downloadUrl": null,
  "segmentsDone": 450,
  "segmentsTotal": 1111,
  "bytesDownloaded": 312456789,
  "error": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---



## 9. Playback integration



### Recommended flow

```
1. GET /play/movie/{tmdbId}
2. Pick source (use recommended or user quality choice)
3. Pass source.url to your video player (HLS)
4. Pass subtitle.url entries as text tracks
5. On timeupdate → POST /progress (or Appwrite)
6. On error → POST /play/report { provider, success: false }
                  → retry with ?server=OtherProvider
```



### Player requirements

- **HLS support** required (ExoPlayer, AVPlayer, Tizen web player + HLS.js, etc.)
- Use the **proxied URL** from the API — never the raw CDN URL in the client
- For TV: ensure `PUBLIC_BASE` is reachable from the device



### m3u8 rewrite behavior

When `/proxy/stream` fetches a `.m3u8`:

1. Injects Vidking headers upstream
2. Rewrites every segment line and `URI="..."` in tags to route through `/proxy/stream`
3. Sets header `x-m3u8-rewritten: true`

Nested playlists are rewritten on each fetch automatically. **The player never contacts CDN hosts directly.**

### Server switching UX

Expose a "Source" or "Server" picker:

```http
GET /providers
GET /play/movie/27205?server=Oxygen
```

Report outcomes so health stats improve over time:

```http
POST /play/report
{ "provider": "Oxygen", "success": true }
```

---



## 10. Subtitles



### Built-in — no OpenSubtitles required

Subtitles come from the **same decrypted WingsDatabase response** as video. The API:

1. Extracts `subtitles[]` from upstream
2. **Dedupes** by `language + url` (upstream can return 150+ duplicate tracks)
3. Proxies all subtitle URLs through `/proxy/stream`
4. Assigns stable IDs: `sub-{lang}-{index}`



### Endpoints


| Use case              | Endpoint                                          |
| --------------------- | ------------------------------------------------- |
| List tracks           | `GET /subtitles/movie/:id` or included in `/play` |
| Player text track URL | Use `subtitles[n].url` from play response         |
| Fetch raw VTT         | `GET /subtitle/:trackId?tmdbId=&type=movie`       |




### App considerations


| Topic                       | Guidance                                                                    |
| --------------------------- | --------------------------------------------------------------------------- |
| **Dedup**                   | API dedupes server-side; UI can still group by `language`                   |
| **Default track**           | First track has `default: true` after dedupe                                |
| **Missing language**        | Upstream may not have all languages — optional OpenSubtitles fallback later |
| **Format**                  | Typically WebVTT; served through proxy with correct content-type            |
| **Same fragility as video** | If resolve fails, subtitles fail too                                        |




### When to add OpenSubtitles (optional, app layer)

- Title has zero subtitle tracks
- User wants a language upstream doesn't provide
- User wants forced/SDH or higher-quality community subs

---



## 11. Offline downloads



### How it works

1. Resolve source (same as play)
2. **Parallel HLS download** — fetches segments concurrently (default 16)
3. **ffmpeg mux** — concat + copy to MP4 (~seconds)

> **ffmpeg is NOT the bottleneck.** Segment download from CDN is ~95% of total time.



### Verified timings (Inception, TMDB 27205)


| Test              | Quality | Scope                     | Time           | Output           |
| ----------------- | ------- | ------------------------- | -------------- | ---------------- |
| Proof clip        | 480p    | 120 seconds (15 segments) | **~14s**       | 12 MiB, 854×480  |
| Full movie        | 480p    | 1,111 segments, 2h29m     | **~8 min**     | 696 MiB, 854×480 |
| Full movie (est.) | 1080p   | 1,111 segments, 2h29m     | **~20–35 min** | ~2–3 GB          |




### Source facts (Inception)

- **No direct MP4** — all qualities are m3u8
- Qualities available: **1080p, 720p, 480p, 4K** (Hydrogen)
- Feature length: **~1,111 segments × ~8s** ≈ 2h 28m
- Segments use **disguised extensions** (`.jpg`, `.html`, `.js`, `.css`) — MPEG-TS bytes inside



### Recommended download architecture for apps

**Pattern A (recommended):** Server downloads, client fetches file

```
App → POST /download/movie/27205 → API host rips with ffmpeg
App → poll GET /download/jobs/:id
App → GET /downloads/movie-27205-inception.mp4 → save locally
```

Works on **macOS, Android, Tizen, iOS** — device doesn't need ffmpeg.

**Pattern B:** Client-side segment download — hard on Android/Tizen; feasible on macOS only.

### Speed tips


| Tip                           | Effect                                           |
| ----------------------------- | ------------------------------------------------ |
| `"concurrency": 32`           | May help if CDN allows more parallel connections |
| Run API on wired/fast network | Biggest real-world win                           |
| Try different `server`        | CDNs vary by provider                            |
| `proofSeconds: 120`           | Quick "can we download?" test (~15s)             |
| 480p vs 1080p                 | ~4× less data for full movie                     |




### Do not

- Download through proxied m3u8 with ffmpeg directly (Content-Type issues on disguised segments)
- Cache download URLs long-term (tokens expire mid-rip on very long jobs)
- Run full rips on TV hardware — use server-side jobs

---



## 12. Progress & continue watching



### API behavior

- Stored in `data/progress.json` (single file, keyed by movie or tv:season:episode)
- `POST /progress` computes `percent` from position/duration
- `GET /continue-watching` filters 2%–95% watched, newest first



### App + Appwrite recommendation


| Data                             | Where                             |
| -------------------------------- | --------------------------------- |
| Playback position (multi-device) | **Appwrite** documents per user   |
| Continue watching row metadata   | Appwrite (title, poster, percent) |
| Optional local cache             | API `/progress` or in-memory      |


Vidking's embed player uses `postMessage` for progress — your app should use player `timeupdate` events and write to Appwrite (and optionally mirror to API).

### Progress key format (if syncing manually)

- Movie: `movie:{tmdbId}`
- TV: `tv:{tmdbId}:{season}:{episode}`

---



## 13. Provider health & server switching



### GET `/providers`

Returns servers with accumulated stats:

```json
{
  "providers": [
    {
      "id": "hydrogen",
      "name": "Hydrogen",
      "endpoint": "cdn/sources-with-title",
      "status": "up",
      "successes": 42,
      "failures": 3,
      "lastSuccessAt": "...",
      "lastFailureAt": "..."
    }
  ]
}
```

`status`: `up` (success rate ≥ 50%), `down`, or `unknown`.

### POST `/play/report`

```json
{ "provider": "Hydrogen", "success": false }
```

**App should report** on playback start failure, buffering timeout, or successful playback start.

---



## 14. Proxy layer (critical for TV)



### Why it exists

CDN hosts require `Origin: https://www.vidking.net` and `Referer`. Smart TVs and many players cannot set these headers on HLS segment requests. The proxy:

1. Adds headers on every upstream fetch
2. Rewrites m3u8 so **all** segment URLs loop back through the proxy



### `PUBLIC_BASE` must be client-reachable

Proxied URLs look like:

```
http://192.168.1.10:8790/proxy/stream?url=https%3A%2F%2Fmoon.ironbubble.site%2F...
```

If `PUBLIC_BASE` is `localhost`, a TV cannot fetch segments.

### CORS

Proxy responses include `access-control-allow-origin: *` for web-based players.

---



## 15. Appwrite & application-layer integration



### Recommended split


| Concern                                | Service                                        |
| -------------------------------------- | ---------------------------------------------- |
| Stream resolve + play                  | `tizenflix-api`                                |
| Catalog (or cache TMDB responses)      | API now; optionally cache in Appwrite          |
| Auth, profiles, households             | **Appwrite Auth**                              |
| Watchlists, favorites, ratings         | **Appwrite Database**                          |
| Cross-device progress                  | **Appwrite Database**                          |
| Subtitle language preference           | Appwrite user settings                         |
| Download job tracking (user's library) | Appwrite + API job ID reference                |
| Offline file storage on device         | Local filesystem / app storage                 |
| Ripped MP4 hosting                     | API `data/downloads/` or Appwrite Storage / S3 |




### Do not put in Appwrite

- Long-lived stream URLs (they expire)
- Decrypted CDN tokens as permanent assets
- The resolve/decrypt logic (keep in tizenflix-api)



### Typical app data model (Appwrite)

```
users/{userId}
users/{userId}/progress/{contentKey}     # position, percent, updatedAt
users/{userId}/watchlist/{tmdbId}
users/{userId}/downloads/{jobId}         # references API job + local path
users/{userId}/preferences               # default quality, subtitle lang
```

---



## 16. Platform notes (Tizen, Android, macOS)



### Tizen / Samsung TV

- Set `PUBLIC_BASE` to LAN IP
- Use web app or TizenBrew with HLS-capable player
- Only talk to `tizenflix-api` — never Vidking/CDN directly
- Offline: server-side download → transfer file to TV (USB/NAS) or skip on-device rip



### Android / Android TV

- ExoPlayer with HLS; pass proxied `source.url`
- Subtitles: ExoPlayer `MediaItem` subtitle configuration with proxied VTT URLs
- Downloads: `POST /download` on home server → WorkManager poll → save MP4
- Progress: Appwrite sync on `onPositionDiscontinuity` / periodic save



### macOS

- AVPlayer with proxied HLS URL
- Can run `tizenflix-api` locally (`npm run api`)
- Downloads: same job API or CLI `npm run download`



### Streaming vs downloading


|          | Streaming   | Downloading             |
| -------- | ----------- | ----------------------- |
| Starts   | Immediately | After full rip          |
| API      | `GET /play` | `POST /download` + poll |
| Best for | Watch now   | Offline library         |


---



## 17. App development checklist



### Must do

- [ ] Configure `PUBLIC_BASE` to LAN IP for non-localhost clients
- [ ] Use **proxied URLs** from API responses only
- [ ] Handle **502 errors** on `/play` — retry with different `?server=`
- [ ] Call `POST /play/report` on success/failure
- [ ] Dedupe subtitle display by `language` (API dedupes URLs; UI may still show duplicates by label)
- [ ] Don't cache stream URLs beyond current session
- [ ] Set `TMDB_API_KEY` for catalog features
- [ ] Show download progress via `segmentsDone` / `segmentsTotal`



### Should do

- [ ] Sync progress to Appwrite (not rely on API local JSON in production)
- [ ] Quality picker using `sources[].label` (1080p, 720p, 480p, 4K)
- [ ] Server picker using `/providers` + health `status`
- [ ] Continue watching from Appwrite or `GET /continue-watching`
- [ ] Graceful empty states when upstream has no sources
- [ ] Poll download jobs every 3–5s; show `downloading` / `muxing` states



### Nice to have

- [ ] OpenSubtitles fallback when `subtitles.length === 0`
- [ ] Prefetch `/title` metadata while showing browse rows
- [ ] Remember last working `server` per user (Appwrite)
- [ ] `proofSeconds` download for "test offline" UX before full rip



### Do not do

- [ ] Call `api.wingsdatabase.com` or CDN hosts from the client
- [ ] Store raw m3u8 URLs in Appwrite long-term
- [ ] Assume every title has MP4 (most are m3u8 only)
- [ ] Run ffmpeg on TV for full movie rips
- [ ] Use `localhost` in proxied URLs for TV testing

---



## 18. Resilience & fragility analysis



### What's stable (your side)


| Component                   | Stability             |
| --------------------------- | --------------------- |
| tizenflix-api HTTP contract | High — you control it |
| TMDB catalog                | High — official API   |
| Appwrite integration        | High — your choice    |
| Proxy architecture          | High — self-contained |




### What's fragile (upstream)


| Risk                         | Severity        | Symptom                               | Mitigation                                        |
| ---------------------------- | --------------- | ------------------------------------- | ------------------------------------------------- |
| Vidking player bundle update | **Very high**   | Decrypt fails, garbage JSON           | `npm run capture`; update `src/crypto/decrypt.ts` |
| `enc` version change         | **High**        | All sources fail                      | Monitor capture; update encryption version        |
| Header lockdown              | **High**        | Seed 403                              | May need headless browser bridge                  |
| Individual server death      | Medium          | One provider empty                    | 5-server fallback; `/play/report`                 |
| CDN token expiry             | Medium          | Mid-playback 403 or mid-download fail | Re-resolve; future: resume download               |
| CDN domain rotation          | Low             | Usually transparent                   | URLs come fresh from decrypt                      |
| Vidking platform shutdown    | **Existential** | Everything fails                      | New provider integration                          |
| ffmpeg version quirks        | Low             | HLS extension reject                  | Parallel downloader avoids sequential ffmpeg HLS  |




### Likely breakage timeline

- **Degraded** (one server down): common, handled by fallback
- **Crypto change** (player deploy): every few weeks to months in this ecosystem
- **Total outage**: rare but possible



### Monitoring recommendations

1. Run `npm test` on a schedule (hits live APIs)
2. Run `npm run capture` weekly; diff player bundle filename/hash
3. Alert if `/play/movie/27205` returns 502 N times in a row
4. Track `/providers` health in your ops dashboard



### What we deliberately did NOT replicate from Vidking

- iframe `postMessage` progress protocol (use Appwrite instead)
- Standalone `subs.videasy.to` client (subs come via resolve)
- Server health UI from embed player (we have `/providers` + `/play/report`)
- Crypto rotation auto-detection (manual capture + update)

---



## 19. Performance & bottlenecks



### Resolve (`GET /play`)


| Stage                     | Typical time |
| ------------------------- | ------------ |
| Metadata + seed + decrypt | **< 1s**     |
| Wrap proxy URLs           | negligible   |


**Not a bottleneck.**

### Streaming playback

Starts as soon as the player buffers the first HLS segments. **Not limited by total file size.**

### Full movie download


| Stage                  | % of time |
| ---------------------- | --------- |
| Resolve                | < 1%      |
| Parallel segment fetch | **~95%**  |
| ffmpeg mux             | < 5%      |


**Bottleneck = CDN bandwidth × segment count × segment size.**

### Inception reference numbers


| Quality         | Segments | ~Runtime | ~Size                          |
| --------------- | -------- | -------- | ------------------------------ |
| 1080p/720p/480p | 1,111    | 2h 28m   | 480p ≈ 700 MiB; 1080p ≈ 2–3 GB |
| 4K              | 853      | 2h 28m   | Much larger per segment        |


Sequential ffmpeg (old approach) estimated **3–6 hours** for 1080p. Parallel downloader: **~8 min (480p full)**, **~20–35 min (1080p est.)**.

---



## 20. Operational maintenance



### When Vidking deploys an update

```bash
npm run capture                    # save fixtures/capture-*.json
# Check if VideoPlayer-*.js filename changed
npm test                           # integration tests hit live API
```

If tests fail:

1. Diff new player JS for crypto/API changes
2. Update `src/crypto/decrypt.ts`, `src/constants/servers.ts`, `ENCRYPTION_VERSION`
3. Re-run tests



### Pinning reference

- Player bundle: `VideoPlayer-CfmbsjlB.js`
- Encryption: `enc=2`, magic `mvm1`



### Dependencies

- Node.js ≥ 18
- ffmpeg (downloads only)
- Playwright + Chromium (`npm run capture` only)

---



## 21. CLI tools

```bash
# Resolve streams (human or --json)
npm run resolve -- movie 27205
npm run resolve -- movie 27205 --server Oxygen
npm run resolve -- tv 1396 1 1 --all-servers
npm run resolve -- movie 27205 --json

# Download (parallel HLS)
npm run download -- movie 27205 -o inception.mp4
npm run download -- movie 27205 --quality 480p --proof-seconds 120 -o proof.mp4
npm run download -- movie 27205 --quality 1080p --concurrency 32 -o out.mp4
npm run download -- movie 27205 --verify-only -o manifest.m3u8

# HTTP API
PUBLIC_BASE=http://192.168.1.10:8790 npm run api

# Network capture (detect upstream changes)
npm run capture

# Save decrypt fixtures
npm run save-fixtures -- 27205

# Tests
npm test
```

---



## 22. Verified test results


| Test                           | Status | Notes                             |
| ------------------------------ | ------ | --------------------------------- |
| Movie 27205 resolve            | PASS   | Hydrogen 1080p/720p/480p/4K m3u8  |
| TV 1396 S1E1 resolve           | PASS   | Breaking Bad via Hydrogen         |
| Server switch Oxygen           | PASS   | `?server=Oxygen`                  |
| Play API /health               | PASS   |                                   |
| Play API /play/movie           | PASS   | Proxied source URLs               |
| m3u8 proxy rewrite             | PASS   | 0 bare CDN URLs; segments proxied |
| Parallel download proof (120s) | PASS   | ~14s, 12 MiB, 854×480             |
| Parallel download full (480p)  | PASS   | ~8 min, 696 MiB, 2h29m            |
| Unit/integration tests         | PASS   | 12/12                             |
| Subtitle dedupe                | PASS   | Server-side in normalize          |


Reference TMDB IDs for testing:


| Title             | TMDB ID      | Type  |
| ----------------- | ------------ | ----- |
| Inception         | 27205        | movie |
| Breaking Bad S1E1 | 1396 / 1 / 1 | tv    |


---



## 23. Known limitations



### API limitations

- No authentication on API endpoints (add reverse proxy or app-level if needed)
- Progress stored in local JSON (not multi-user)
- Download jobs are single-host (no distributed queue)
- No mid-download URL refresh if CDN tokens expire
- Catalog requires internet + valid TMDB key
- Browse rows are fixed set of 4 (not personalized)



### Upstream limitations

- No MP4 for many titles (HLS only)
- Subtitle availability varies by title
- 4K only on some servers/titles (Hydrogen for Inception)
- CDN cold-start latency on first segment per host (10–60s possible)
- Grey-area third-party sources — no reliability SLA



### Intentionally deferred to app layer

- User accounts, profiles, parental controls
- Watchlists, ratings, reviews
- Personalized recommendations beyond TMDB browse
- OpenSubtitles fallback
- Auth on `/downloads/:filename`
- Download quotas / disk management
- Multi-tenant API keys

---



## 24. Example end-to-end flows



### A. Home screen → play movie

```
GET /browse/rows
GET /browse/row/trending-movies
  → user picks tmdbId 27205
GET /title/movie/27205          (detail page)
GET /play/movie/27205           (player)
  → play sources[0].url in HLS player
  → attach subtitles[0].url as text track
POST /progress every 30s        (or Appwrite)
```



### B. Search → TV episode

```
GET /search?q=breaking+bad
GET /title/tv/1396/seasons
GET /title/tv/1396/1/episodes
GET /play/tv/1396/1/1
```



### C. Playback failure → server switch

```
GET /play/movie/27205           → 502
GET /providers                  → pick Oxygen (status: up)
GET /play/movie/27205?server=Oxygen
POST /play/report { "provider": "Hydrogen", "success": false }
POST /play/report { "provider": "Oxygen", "success": true }
```



### D. Offline download (Android)

```
POST /download/movie/27205
  body: { "quality": "480p", "concurrency": 16 }
  → 202 { job, statusUrl }

loop every 5s:
  GET /download/jobs/{id}
  → show segmentsDone/segmentsTotal

when status === "completed":
  GET /downloads/movie-27205-inception.mp4
  → save to app storage
  → record in Appwrite downloads collection
```



### E. Quick download proof (dev)

```
POST /download/movie/27205
  body: { "quality": "480p", "proofSeconds": 120 }
  → ~15 seconds → completed MP4 (~2 min of content)
```

---



## Quick reference card

```
Base:     {PUBLIC_BASE}  e.g. http://192.168.1.10:8790

Browse:   GET /browse/rows → GET /browse/row/trending-movies
Search:   GET /search?q=inception
Detail:   GET /title/movie/27205
Play:     GET /play/movie/27205
          GET /play/tv/1396/1/1?server=Oxygen
Subs:     included in /play, or GET /subtitles/movie/27205
Progress: POST /progress  |  GET /continue-watching
Download: POST /download/movie/27205 → GET /download/jobs/:id → GET /downloads/:file
Health:   GET /health  |  GET /providers  |  POST /play/report
```

---

*Last updated: 2026-07-12 — reflects tizenflix-api v0.2.0 (parallel HLS downloads, TMDB catalog, subtitle dedupe, provider health).*