# Tizenflix — TizenBrew App Research & Build Plan

> Research compiled 2026-07-12. Educational / personal use only.

This document answers: what we need to ship a TizenBrew application, how to achieve a Netflix/Disney+-quality UI on Samsung TV hardware, what to build beyond the API (Appwrite, algorithms, etc.), and whether `tizenflix-api` is production-ready for streaming.

---

## Table of contents

1. [TizenBrew ecosystem summary](#1-tizenbrew-ecosystem-summary)
2. [Reference apps & patterns](#2-reference-apps--patterns)
3. [What we must build for TizenBrew](#3-what-we-must-build-for-tizenbrew)
4. [Sleek UI on TV — Netflix/Disney+ style](#4-sleek-ui-on-tv--netflixdisney-style)
5. [Application layer — Appwrite & algorithms](#5-application-layer--appwrite--algorithms)
6. [API readiness assessment](#6-api-readiness-assessment)
7. [Recommended architecture](#7-recommended-architecture)
8. [Phased roadmap](#8-phased-roadmap)
9. [Sources](#9-sources)

---

## 1. TizenBrew ecosystem summary

### What TizenBrew is

[TizenBrew](https://github.com/reisxd/TizenBrew) is a **modular homebrew launcher** for Samsung Smart TVs (Tizen 3.0+, 2017+). It installs once as a `.wgt` widget. After that, you add **modules** (npm packages or GitHub repos) without redeploying through Tizen Studio for every update.

**Key facts:**

| Topic | Detail |
|-------|--------|
| TV requirement | Samsung TV, Tizen 3.0+ (2017 or newer) |
| One-time install | TizenBrew Installer Desktop, USB (deprecated), or `tizen install` CLI |
| Module delivery | Fetched from npm/jsDelivr or GitHub; **not baked into the TV** |
| Module types | `app` (hosted web app), `mods` (injected into a website), `service` (Node background) |
| Remote keys | Arrow keys + Enter + Back are automatic; media/color keys must be registered in `package.json` |
| Tizen APIs | Apps loaded through TizenBrew **lose direct Tizen API access** unless you use an adapter (see Jellyfin) |

### Module `package.json` contract

From [TizenBrew MODULES.md](https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md):

**Application module (`packageType: "app"`)** — what Tizenflix should become:

```json
{
  "name": "@your-scope/tizenflix",
  "version": "1.0.0",
  "packageType": "app",
  "appName": "Tizenflix",
  "appPath": "dist/index.html",
  "keys": [
    "MediaPlayPause",
    "MediaFastForward",
    "MediaRewind",
    "ColorF0Red",
    "ColorF1Green"
  ],
  "serviceFile": "service.js",
  "evaluateScriptOnDocumentStart": false
}
```

**Site modification module (`packageType: "mods"`)** — current dev approach in `demo/package.json`:

```json
{
  "packageType": "mods",
  "websiteURL": "https://user.github.io/tizenflix/tests/gate-test.html?v=1",
  "main": "tests/noop.js"
}
```

Mods inject JS into an existing site (e.g. YouTube TV). **Tizenflix should use `app` type** for a standalone Netflix-style client.

### Distribution workflow

1. Build static web assets (`dist/`).
2. Publish npm package (`npm publish --access public`) **or** host on GitHub Pages + register repo in TizenBrew.
3. On TV: TizenBrew → GREEN → add module name (e.g. `@dev-arora/tizenflix`).
4. Launch from TizenBrew module list.

**Cache busting:** bump `?v=` query or npm version after each deploy.

### Developer mode & networking

- Enable Developer Mode: Apps panel → enter `12345` → set Host PC IP.
- For TizenBrew runtime after install: set Host PC IP to `127.0.0.1` and reboot.
- **Critical:** `tizenflix-api` must use `PUBLIC_BASE=http://<LAN-IP>:8790` — TVs cannot reach `localhost` on your PC.

### Tizen API limitations

[Jellyfin's TizenBrew adapter](https://github.com/GlenLowland/jellyfin-tizen-npm-publish/blob/main/tizen-adapter.js) exists because TizenBrew-hosted apps lose native `tizen.*` APIs. For Tizenflix (pure web + HLS), this is **less critical** — we rely on:

- HTML5 `<video>` + HLS.js (or native HLS where supported)
- `keydown` / `keyCode` 10009 for Back
- Optional `tizen.tvinputdevice.registerKey` via TizenBrew's `keys` array

---

## 2. Reference apps & patterns

### TizenTube (`@foxreis/tizentube`) — site mod pattern

| Practice | Takeaway for Tizenflix |
|----------|------------------------|
| `packageType: "mods"` | Injects into YouTube TV URL — **not** our target architecture |
| `serviceFile` + bundled `userScript.js` | Heavy client-side logic shipped as npm package |
| Remote key handling | Custom actions via `resolveCommand.js` pattern |
| Version bumps on every release | Required for jsDelivr cache |

**Lesson:** TizenTube optimizes an existing website. Tizenflix builds a **greenfield SPA** — closer to Jellyfin.

### Jellyfin Tizen (`@glenlowland/jellyfin-tizen`) — app pattern

| Practice | Takeaway for Tizenflix |
|----------|------------------------|
| `packageType: "app"` | Full-screen hosted web client |
| `tizen-adapter.js` | Polyfills Tizen APIs when running inside TizenBrew |
| Connects to self-hosted server | Same model: TV → LAN API (`tizenflix-api`) |
| Mature focus/spatial navigation | Study jellyfin-web TV layout patterns |

### SAWSUBE TizenBrew integration spec

[WB2024/SAWSUBE TizenbrewIntegrationSpec](https://github.com/WB2024/SAWSUBE/blob/main/TizenbrewIntergrationSpec.md) documents:

- Modules are npm packages consumed via `cdn.jsdelivr.net/<package>/...`
- TizenBrew service runs on TV at `127.0.0.1:8081` — **not remotely configurable**
- Curated app lists, module scaffolding, remote key multi-select UI
- Publishing flow: npm account → `npm publish` → add package name on TV

### Our existing packages

| Package | Purpose |
|---------|---------|
| `tizenflix-app/` | **Production TizenBrew app** (`packageType: "app"`) — proof-of-streaming UI |
| `lab/` | Legacy experiments (Vidking iframe, old tmdb-embed-api harness) |

**Gate test checklist** (in `tizenflix-app/app/index.html`):

- [ ] HLS segments load (playback progresses)
- [ ] Back key (10009) returns to TizenBrew

**Decision gate:** If streaming works on real TV → build full Netflix UI. See `docs/tv-setup.md`.

---

## 3. What we must build for TizenBrew

### A. TizenBrew application package

| Component | Description | Status |
|-----------|-------------|--------|
| `package.json` | `packageType: "app"`, keys, appPath | Not started (demo is `mods`) |
| Static web build | Vite/React/Vanilla SPA in `dist/` | Not started |
| API config screen | First-run: enter `PUBLIC_BASE` URL, test `/health` | Not started |
| npm publish / CDN | `@scope/tizenflix` on npm or GitHub Pages | Not started |

### B. TV client application (the actual product)

| Screen / feature | API endpoints used |
|------------------|-------------------|
| Splash + API setup | `GET /health` |
| Home (hero + rows) | `GET /browse/rows`, `GET /browse/row/:id` |
| Search | `GET /search?q=` |
| Title detail (movie) | `GET /title/movie/:id` |
| Title detail (TV) | `GET /title/tv/:id`, seasons, episodes |
| Player | `GET /play/movie/:id` or `/play/tv/:id/:s/:e` |
| Subtitle picker | `subtitles[]` from play response |
| Quality / server picker | `sources[]`, `GET /providers`, `?server=` |
| Continue watching | Appwrite (primary) or `GET /continue-watching` |
| Progress sync | `POST /progress` + Appwrite |
| Downloads library | `POST /download`, poll jobs, fetch MP4 |
| Error recovery | `POST /play/report`, retry alternate server |

### C. Playback stack

| Layer | Choice |
|-------|--------|
| Video | Single reused `<video>` element (avoid decoder leaks on Tizen) |
| HLS | HLS.js (already in `demo/tests/lib/hls.min.js`) or native if MSE available |
| Subtitles | `<track kind="subtitles">` with proxied VTT URLs from API |
| Progress | `timeupdate` every 30s → Appwrite + optional API mirror |
| Server fallback | On 502/buffering timeout → re-resolve with `?server=NextProvider` |

### D. Optional TizenBrew service file

A `service.js` Node script can run background tasks (update checks, local cache). **Not required for v1.** Jellyfin uses this pattern for deeper integration; Tizenflix can defer.

### E. Hosting options

| Option | Pros | Cons |
|--------|------|------|
| npm + jsDelivr | TizenBrew native; versioned | Public package name |
| GitHub Pages | Free; easy CI | Manual module add by repo |
| Self-hosted CDN | Private | User must configure URL in TizenBrew (harder) |

**Recommendation:** npm package for production; GitHub Pages for dev/gate tests (current demo approach).

---

## 4. Sleek UI on TV — Netflix/Disney+ style

### Hardware reality

Samsung TVs run **old Chromium** (M47 on 2017 → M120+ on 2024). Memory and GPU are limited. Netflix/Disney+ smoothness comes from:

1. **Compositor-friendly animations** — only `transform` and `opacity`
2. **Spatial focus system** — not mouse hover
3. **Lazy-loaded images** — TMDB posters at `w342`/`w500`, not full backdrops everywhere
4. **Minimal main-thread work** during scroll/animate

### Visual design tokens (Netflix-like)

```css
:root {
  --bg: #141414;
  --bg-elevated: #1f1f1f;
  --accent: #e50914;          /* Tizenflix brand */
  --text: #ffffff;
  --text-muted: #b3b3b3;
  --focus-ring: #ffffff;
  --row-gap: 4vw;
  --card-radius: 4px;
  --hero-gradient: linear-gradient(to top, #141414 10%, transparent 60%);
}
```

| Element | Netflix pattern | TV-safe implementation |
|---------|-----------------|------------------------|
| Hero banner | Full-width backdrop + gradient + CTA | Single `transform: scale(1.05)` on focus; preload backdrop once |
| Content rows | Horizontal carousels | `translateX` on row container; **virtualize** items (render ±3 off-screen) |
| Cards | Scale up on focus (1.0 → 1.08) | `transform: scale()` + `transition: transform 200ms ease-out` |
| Focus indicator | White border / glow | CSS class `.focused` — **avoid calling `.focus()` on every move** (Tizen perf) |
| Page transitions | Fade + slide | `opacity` crossfade 250ms; defer data fetch until animation ends |
| Skeleton loaders | Shimmer placeholders | CSS `opacity` pulse only — no layout-affecting width animations |
| Player chrome | Auto-hide controls | `opacity` fade; don't animate `height`/`margin` |

### Animation rules (Samsung + community best practices)

**Do:**

- `transform: translate3d()` / `scale()` for movement and focus zoom
- `opacity` for fades and control visibility
- `requestAnimationFrame` for scroll position updates
- Batch DOM reads/writes (read all `offsetWidth` first, then write styles)
- Use `will-change: transform` sparingly on focused card only
- `-webkit-backface-visibility: hidden` on animated rows

**Avoid:**

- Animating `width`, `height`, `margin`, `top`, `left` (forces layout)
- Heavy `box-shadow` animations (use pre-rendered PNG or static shadow)
- `filter: blur()` on large images during scroll
- Multiple simultaneous row animations
- Custom web fonts for body text (use system stack: `SamsungOne`, `-apple-system`, `sans-serif`)
- `grid`/`flex` gaps on Tizen 3–4 without testing (partial support on older models)

### Spatial navigation algorithm

Netflix uses a **2D spatial focus graph**, not simple tab order.

```
Minimum viable (v1):
  - Rows are focus containers
  - Left/Right moves within row
  - Up/Down moves between rows (remember last focused index per row)

Enhanced (v2):
  - Distance-based nearest-neighbor (rect center math)
  - "Scroll into view" with translateX on row, not scrollLeft (smoother on Tizen)
```

Reference implementation started in `demo/tests/common.js` (`setupBasicFocus`) — replace with row-aware spatial nav before production.

### Performance budget

| Metric | Target |
|--------|--------|
| Initial load | < 3s on 2019 TV (code-split; hero only on first paint) |
| Focus move | < 100ms perceived (transform only) |
| Row scroll | 60fps on 2020+; 30fps acceptable on 2017 |
| Player start | < 5s to first frame (resolve is <1s; CDN cold start 10–60s possible) |
| Memory | Destroy off-screen row DOM; reuse video element |

### Image strategy

- Posters: `https://image.tmdb.org/t/p/w342/{path}`
- Hero backdrops: `w1280` max
- Lazy load via `IntersectionObserver` (polyfill for old Tizen if needed)
- Placeholder: dominant-color `#1a1a1a` box (no shimmer on 2017 TVs)

---

## 5. Application layer — Appwrite & algorithms

### Responsibility split

| Concern | Owner |
|---------|-------|
| Stream resolve, proxy, decrypt | `tizenflix-api` ✅ built |
| TMDB catalog proxy | `tizenflix-api` ✅ built |
| Offline rip jobs | `tizenflix-api` ✅ built |
| Auth, profiles | **Appwrite Auth** |
| Cross-device progress | **Appwrite Database** |
| Watchlist, favorites, ratings | **Appwrite Database** |
| Subtitle language preference | Appwrite user settings |
| Recommendations (personalized) | App layer algorithm |
| Provider preference memory | Appwrite per user |

### Appwrite collections (suggested)

```
users/{userId}/profile
  - displayName, avatarUrl, maturityRating, defaultQuality, defaultSubtitleLang

users/{userId}/progress/{contentKey}   # movie:27205 or tv:1396:1:3
  - tmdbId, type, season?, episode?, positionSeconds, durationSeconds,
    percent, title, poster, updatedAt

users/{userId}/watchlist/{tmdbId}
  - tmdbId, type, addedAt

users/{userId}/downloads/{jobId}
  - apiJobId, status, quality, localPath?, downloadUrl?, createdAt

users/{userId}/preferences
  - lastWorkingServer, autoplayNextEpisode, uiTheme
```

### Algorithms to build (app layer)

| Algorithm | Purpose | Complexity |
|-----------|---------|------------|
| **Server fallback** | On play failure, try providers in `SERVER_PRIORITY` order; report via `/play/report` | Low — API already supports |
| **Source picker** | Map user quality pref → best `sources[].label`; fall back to `recommended` | Low |
| **Continue watching row** | Merge Appwrite progress (2–95% watched), sort by `updatedAt`, fetch metadata batch | Medium |
| **Because you watched** | TMDB similar/recommendations API (not in tizenflix-api yet — add or call TMDB from app) | Medium |
| **Trending row merge** | API browse rows + inject continue-watching as first row | Low |
| **Search ranking** | TMDB order + boost watchlist matches | Low |
| **Download queue** | Serialize jobs per user; poll `segmentsDone/Total`; notify on complete | Medium |
| **Poster prefetch** | Prefetch next row's first 5 posters on idle | Low |

### What NOT to put in Appwrite

- Raw CDN / m3u8 URLs (expire in minutes)
- Decrypted stream tokens
- Full TMDB catalog mirror (unless caching for offline browse)

### Auth flow

1. TV app → Appwrite email/session or device code flow
2. Store session in `localStorage` / secure storage
3. All user data keyed by `userId`
4. API stays **unauthenticated** on LAN (or add reverse-proxy API key later)

---

## 6. API readiness assessment

### Verdict: **Yes — the API is in good shape to build the TV app today**

`tizenflix-api` v0.2.0 is a workable backend. Verified capabilities (see `tizenflix-api/RESULTS.md`, `api_info.md`):

| Capability | Status | Notes |
|------------|--------|-------|
| Movie + TV resolve | ✅ | Hydrogen default; 5-server fallback |
| Multiple qualities | ✅ | 1080p, 720p, 480p, 4K (title-dependent) |
| Multiple servers | ✅ | Hydrogen, Titanium, Oxygen, Lithium, Helium |
| Server forcing | ✅ | `?server=Oxygen` |
| Multi-server merge | ✅ | `?all=true` |
| Stream proxy for TV | ✅ | Headers + full m3u8 rewrite |
| Subtitles | ✅ | From upstream; deduped; proxied VTT |
| Provider health | ✅ | `/providers`, `/play/report` |
| TMDB catalog | ✅ | Search, browse, title detail |
| Watch progress (local) | ✅ | JSON file — use Appwrite for prod |
| Offline download | ✅ | Parallel HLS + ffmpeg mux (~8 min full movie 480p) |
| Tests | ✅ | 12/12 passing when network available |

### Streaming consistency

**Works well when:**

- API host has stable LAN connection to TV
- `PUBLIC_BASE` is correct
- Hydrogen (or fallback server) is up
- Client uses proxied URLs only

**Known fragility (upstream, not your code):**

| Risk | Mitigation in API |
|------|-------------------|
| Vidking crypto/bundle change | `npm run capture`; update `decrypt.ts` |
| CDN token expiry mid-playback | Re-call `/play`; app should auto-retry |
| Single server down | Automatic fallback order |
| CDN cold start (10–60s) | UI loading state; server switch |
| No MP4 for most titles | HLS only — player must support m3u8 |

### Gaps (defer to app or future API work)

| Gap | Priority | Owner |
|-----|----------|-------|
| User auth on API | Low (LAN trust) | Reverse proxy optional |
| Personalized browse rows | Medium | App + TMDB recommendations |
| OpenSubtitles fallback | Low | App layer |
| Mid-download URL refresh | Medium | API enhancement |
| Multi-user progress | High for prod | Appwrite |
| API versioning | Low | When breaking changes |

### Migration from demo to tizenflix-api

The `demo/` harness still references **tmdb-embed-api** (`localhost:8787`). The production TV app should use **tizenflix-api** (`:8790`):

| Demo | Production |
|------|------------|
| `GET /api/streams/movie/:id` | `GET /play/movie/:id` |
| OpenSubtitles proxy | Subtitles in `/play` response |
| Docker compose | `npm run api` + `PUBLIC_BASE` |

---

## 7. Recommended architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Samsung TV — TizenBrew                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  @scope/tizenflix (SPA)                              │    │
│  │  • spatial focus UI                                  │    │
│  │  • HLS.js player                                     │    │
│  │  • Appwrite SDK (auth, progress, lists)               │    │
│  └──────────────┬────────────────────┬─────────────────┘    │
└─────────────────┼────────────────────┼────────────────────────┘
                  │ LAN HTTP           │ HTTPS
                  ▼                    ▼
     ┌────────────────────┐   ┌──────────────────┐
     │  tizenflix-api       │   │  Appwrite Cloud  │
     │  :8790               │   │  (auth + DB)     │
     │  • /play /proxy      │   └──────────────────┘
     │  • TMDB catalog      │
     │  • downloads         │
     └──────────┬───────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
   TMDB v3         WingsDatabase/Vidking CDN
```

---

## 8. Phased roadmap

### Phase 0 — Validate on real TV (current)

- [ ] Run gate test on Samsung TV via TizenBrew mods + GitHub Pages
- [ ] Confirm Gate B with `tizenflix-api` on LAN (`PUBLIC_BASE`)
- [ ] Record results in `demo/tests/RESULTS.md`

### Phase 1 — MVP app module

- [ ] Scaffold SPA (Vite + vanilla or React)
- [ ] `packageType: "app"` npm package
- [ ] API settings screen + health check
- [ ] Home rows + title detail + basic player
- [ ] Back key + spatial focus

### Phase 2 — Netflix polish

- [ ] Hero banner + row carousels with transform animations
- [ ] Continue watching row
- [ ] Quality + server picker
- [ ] Subtitle language picker
- [ ] Player chrome auto-hide

### Phase 3 — User features (Appwrite)

- [ ] Auth + profiles
- [ ] Progress sync across devices
- [ ] Watchlist
- [ ] Download library UI (server-side jobs)

### Phase 4 — Resilience & ops

- [ ] Auto server fallback in player
- [ ] Weekly `npm run capture` cron
- [ ] Optional OpenSubtitles fallback

---

## 9. Sources

| Resource | URL |
|----------|-----|
| TizenBrew | https://github.com/reisxd/TizenBrew |
| TizenBrew modules guide | https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md |
| TizenBrew install guide | https://github.com/reisxd/TizenBrew/blob/main/docs/README.md |
| TizenTube (mods example) | https://github.com/reisxd/TizenTube |
| Jellyfin TizenBrew package | https://github.com/GlenLowland/jellyfin-tizen-npm-publish |
| SAWSUBE integration spec | https://github.com/WB2024/SAWSUBE/blob/main/TizenbrewIntergrationSpec.md |
| Samsung TVInputDevice API | https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/tvinputdevice-api.html |
| Samsung launch perf guide | https://developer.samsung.com/smarttv/develop/guides/application-performance-improvement/launch-time-optimization.html |
| Tizenflix API reference | `tizenflix-api/api_info.md` |
| Tizenflix demo harness | `demo/README.md` |

---

*This document should be updated after TV gate tests and when the app module scaffold lands.*
