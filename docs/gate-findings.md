# Tizenflix gate test — findings & architecture handoff

> Compiled 2026-07-12 after Samsung TV playback validation. Educational / personal use only.

This document captures everything learned from the gate test (Inception movie + Off Campus TV), how the video player should be architected, and what to build next for the full Tizenflix application.

**Related docs:** [tv-setup.md](./tv-setup.md) (how to run the gate), [tizenbrew-app-research.md](./tizenbrew-app-research.md) (TizenBrew ecosystem & UI roadmap).

---

## Table of contents

1. [Gate status](#1-gate-status)
2. [Test matrix](#2-test-matrix)
3. [Root causes we fixed](#3-root-causes-we-fixed)
4. [Video player architecture](#4-video-player-architecture)
5. [API & proxy architecture](#5-api--proxy-architecture)
6. [Provider/CDN state](#6-providercdn-state)
7. [Tizen & TizenBrew constraints](#7-tizen--tizenbrew-constraints)
8. [Full app architecture](#8-full-app-architecture)
9. [What to build next](#9-what-to-build-next)
10. [Go / no-go checklist](#10-go--no-go-checklist)

---

## 1. Gate status

| Area | Status | Notes |
|------|--------|-------|
| LAN connectivity (TV → API) | **PASS** | `PUBLIC_BASE` must be PC LAN IP, not `localhost` |
| LAN MP4 sample | **PASS** | `GET /test/sample.mp4` — proves `<video>` works |
| LAN HLS sample | **PASS** | `GET /test/sample.m3u8` — proves HLS.js path on TV |
| Movie playback (Inception) | **PASS** | TMDB `27205`, Oxygen HLS ~1280×540 |
| TV episode playback (Off Campus) | **PENDING TV RETEST** | TMDB `273240` S1E1–E3 buttons added; run on TV |
| Back key | **PASS** | `keyCode 10009` received |
| Play / Pause | **PASS** | UI button + `MediaPlayPause` remote key |

**Decision:** Movie gate passed. TV episode gate is the last pre-UI validation. After Off Campus S1E1 plays with picture + sound, proceed to full UI build.

---

## 2. Test matrix

### Gate UI (`tizenflix-app/app/gate/index.html`)

| Button | Endpoint | What it proves |
|--------|----------|----------------|
| **Test LAN MP4** | `/test/sample.mp4` | Plain progressive MP4, no HLS |
| **Test LAN HLS** | `/test/sample.m3u8` | Local HLS through API static route |
| **Play movie** | `/play/movie/27205` | Full resolve + proxy + HLS for movies |
| **S1E1 / S1E2 / S1E3** | `/play/tv/273240/1/{ep}` | TV episode — API picks best validated provider |
| **Stop** | — | Teardown HLS instance, exit playback mode |
| **Play / Pause** | — | Manual resume when autoplay blocked |

### Test content IDs

| Title | Type | TMDB ID | Season / Episode |
|-------|------|---------|------------------|
| Inception | Movie | `27205` | — |
| Off Campus | TV | `273240` | S1E1, S1E2, S1E3 |

### Environment

```
Samsung TV (TizenBrew)
  → http://192.168.86.49:3010/app/index.html   (main app)
  → http://192.168.86.49:3010/app/gate/index.html   (gate test)
  → http://192.168.86.49:8790                  (tizenflix-api)
       → /play/movie|tv/...  (resolve)
       → /proxy/stream?url=... (rewrite m3u8, simplify master)
       → upstream CDN (Oxygen, Hydrogen, …)
```

---

## 3. Root causes we fixed

| Symptom | Root cause | Fix |
|---------|------------|-----|
| `Cannot read property 'catch' of undefined` | Tizen `video.play()` returns `undefined`, not a Promise | `safePlay()` — never chain `.catch` on `play()` |
| HLS blank screen, manifest errors | Hydrogen CDN **HTTP 403**; proxy rewrote 403 HTML as fake m3u8 | Proxy only rewrites bodies starting with `#EXTM3U` on 2xx; `validatePlaySources()` adds `warnings[]` |
| MP4 test showed HLS manifest error | Stale HLS session; no full teardown in `playDirect` | `destroyPlayer()` + play session generation IDs |
| Video freeze, audio continues | Oxygen **demuxed master** (many audio tracks); native HLS on Tizen struggles | HLS.js first for `/proxy/stream` URLs; `simplifyMasterForTv()` on API |
| Low quality (640×270) | Intentionally picked lowest variant | Pick **highest resolution ≤ 1080p** → ~1280×540 on Oxygen |
| Stuttering, `fragLoadTimeOut` | Started play too early; aggressive recovery | 20s buffer priming, multi-rung ABR ladder, active stall/frag recovery |
| Black UI, invisible text | CSS `var(--*)`, ES modules | Literal hex colors; bundled `app/dist/app.bundle.js` (esbuild, ES2015) |
| Video loads but stays paused | `play()` called at `rs=0 ns=3` | Wait for `canplay` / `loadedmetadata` before `safePlay()` |

---

## 4. Video player architecture

### Design principle

**One shared player module** (`tizenflix-app/app/js/player.js`) used by gate test and future full UI. No iframe embeds. All streams go through `tizenflix-api` proxy so segment URLs are LAN-reachable.

### Playback decision tree

```
playSources(sources[])
  │
  ├─ For each m3u8 source (API-validated order):
  │    playUrlAttempt(proxiedUrl)
  │      │
  │      ├─ URL contains /proxy/stream ?
  │      │    └─ HLS.js (preferred on Tizen for demuxed masters)
  │      │
  │      ├─ Else if Tizen + canPlayType(m3u8) ?
  │      │    └─ Native HLS → on stall/error → fallback HLS.js
  │      │
  │      └─ Else HLS.js
  │
  └─ On source failure → try next source
```

### Key player behaviors

| Concern | Implementation |
|---------|----------------|
| **Safe play** | `safePlay(video)` — handles undefined return from Tizen |
| **Session isolation** | `playGeneration` counter; ignore stale callbacks after stop/switch |
| **Teardown** | `destroyPlayer()` — detach HLS, clear src, `video.load()` |
| **HLS.js tuning** | 20s prime buffer; multi-rung master (up to 3 levels); non-fatal stall/frag recovery |
| **Quality settings (future)** | `getQualityMode()` / `applyQualityMode()` / `getQualityOptions()` in player.js |
| **Playback mode** | `enterPlaybackMode()` hides setup panels; playback bar with Stop + Play/Pause |
| **Debug** | Bottom overlay: `readyState`, `networkState`, HLS events, quality on `LEVEL_LOADED` |
| **Remote keys** | Back (`10009`), MediaPlayPause |

### What the full app should reuse

- `playSources()` / `playUrl()` / `destroyPlayer()` / `togglePlayPause()` as the single playback API
- `config.listSourcesToTry(play)` — respects API `warnings` and `recommended`
- `config.resolveMovie()` / `config.resolveTvEpisode()` — thin fetch wrappers
- No direct CDN URLs in the client — always proxied `source.url` from `/play` response

### Future player enhancements (post-gate)

| Feature | Approach |
|---------|----------|
| **Resume position** | `video.currentTime` + Appwrite progress store |
| **Subtitle tracks** | Parse `#EXT-X-MEDIA` from master; `<track>` or HLS.js subtitle API |
| **Audio track picker** | After `simplifyMasterForTv`, usually one track; expose if multi-language returns |
| **Quality picker** | HLS.js `levels` API; default auto (highest ≤1080p) |
| **Loudness** | Source streams are quiet vs Netflix; optional Web Audio gain node (test on TV first) |
| **Skip intro / next episode** | UI timers from episode metadata — not in gate scope |

---

## 5. API & proxy architecture

### Play flow

```
GET /play/movie/:tmdbId
GET /play/tv/:tmdbId/:season/:episode
  │
  ├─ fetchMetadata() — TMDB title/year/imdb via wingsdatabase proxy
  ├─ fetchServerSources() — per-provider resolve (Vidking-style)
  ├─ preferHlsSources() — HLS over DASH for TV client
  ├─ validatePlaySources() — HEAD/GET probe manifests; build warnings[]
  └─ toPlayResponse() — sources[], recommended, warnings, title
```

### Proxy flow

```
GET /proxy/stream?url=<encoded-upstream>
  │
  ├─ Fetch upstream with VIDKING_HEADERS
  ├─ If status 2xx AND body starts with #EXTM3U:
  │    rewriteM3u8() — absolute URLs → proxy URLs
  │    simplifyMasterForTv() — one English audio + best video ≤1080p
  └─ Else pass through (or error) — never fake m3u8 from HTML error pages
```

### Critical config

| Variable | Purpose |
|----------|---------|
| `PUBLIC_BASE` | LAN URL embedded in every proxied segment URL (must be TV-reachable) |
| `TMDB_API_KEY` | Required for `/search`, `/title/*`; optional for `/play` if metadata proxy works |
| `PORT` | Default `8790` |

### API routes the full app will use

| Route | Use in app |
|-------|------------|
| `GET /health` | Connection indicator |
| `GET /search?q=` | Search bar |
| `GET /title/movie/:id` | Movie detail page |
| `GET /title/tv/:id` | Series detail |
| `GET /title/tv/:id/seasons` | Season list |
| `GET /title/tv/:id/:season/episodes` | Episode picker |
| `GET /play/movie/:id` | Movie play |
| `GET /play/tv/:id/:s/:e` | Episode play |

---

## 6. Provider/CDN state

*Snapshot at gate testing — providers change frequently.*

| Provider | Movie (Inception) | Notes |
|----------|-------------------|-------|
| **Hydrogen** | **BLOCKED** — all qualities HTTP 403 | Resolve works; playback fails at CDN |
| **Oxygen** | **WORKS** — HLS master, simplified to ~1280×540 | Best current option for TV |
| Titanium / Lithium / Helium | Varies | Use `?server=` or `allServers` + validation |

| Limitation | Detail |
|------------|--------|
| Max quality on Oxygen | ~1280×540 for Inception (not true 1080p) |
| Audio level | Audible at ~50% TV volume; no loudness normalization in source |
| TV vs movie | Same `/play` + proxy pipeline; episode path adds season/episode to resolver |

The API is **not broken** when Hydrogen 403s — validation surfaces warnings and the client skips dead sources.

---

## 7. Tizen & TizenBrew constraints

### Must-follow rules

| Rule | Why |
|------|-----|
| Bundle JS with esbuild (`target: es2015`) | Tizen WebKit may not run ES modules |
| No CSS custom properties (`var(--x)`) | Older Tizen builds ignore them → invisible UI |
| No `gap`, `aspect-ratio` in critical layout | Use margins / padding / fixed heights |
| `PUBLIC_BASE` = LAN IP | TV cannot reach `localhost` on dev PC |
| `safePlay()` | `video.play()` is not Promise-based on Samsung |
| Register media keys in `package.json` `keys` array | `MediaPlayPause`, FF, RW |
| Rebuild + GitHub release bump for TV | TizenBrew caches module; bump version or re-add module |

### TizenBrew module shape (current → target)

| Phase | `packageType` | Delivery |
|-------|---------------|----------|
| Gate (now) | `mods` with `websiteURL` | LAN dev server or GitHub release |
| Production app | `app` with `appPath` | npm publish or GitHub |

### Debugging on TV

- On-screen **debug overlay** (bottom) — no DevTools on TV
- **Player log** panel — timestamped resolve/play events
- **Focus hint** (top-right) — D-pad navigation confirmation

---

## 8. Full app architecture

```
┌─────────────────────────────────────────────────────────────┐
│  TizenBrew (Samsung TV)                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  tizenflix-app (static SPA, bundled JS)                │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │  │
│  │  │ Browse  │ │ Detail   │ │ Player │ │ Settings     │  │  │
│  │  │ rows    │ │ movie/tv │ │ module │ │ API URL      │  │  │
│  │  └────┬────┘ └────┬─────┘ └───┬────┘ └──────────────┘  │  │
│  │       │           │           │                         │  │
│  │       └───────────┴───────────┘                         │  │
│  │                   │ fetch (LAN)                         │  │
│  └───────────────────┼─────────────────────────────────────┘  │
└──────────────────────┼────────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  tizenflix-api (Node, port 8790)                              │
│  /search /title/* /play/* /proxy/stream /test/*               │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
              Upstream providers (Oxygen, …)
```

### Client module layout (suggested)

```
tizenflix-app/app/js/
  main.js          — bootstrap, routing shell
  config.js        — API base, resolve helpers
  player.js        — HLS/native playback (keep as-is)
  focus.js         — spatial navigation
  debug.js         — overlay logging
  screens/
    home.js        — hero + content rows
    detail-movie.js
    detail-tv.js   — seasons + episodes
    player-screen.js — wraps player.js + controls
  components/
    row.js         — horizontal scroll list
    card.js        — poster tile
    episode-list.js
```

### State & backend (phase 2)

| Concern | Service |
|---------|---------|
| Auth, profiles | Appwrite |
| Watch progress | `users/{id}/progress/{contentKey}` — `movie:27205` or `tv:273240:1:3` |
| Watchlist | Appwrite collection |
| Recommendations | TMDB trending + personal history (later) |

See [tizenbrew-app-research.md](./tizenbrew-app-research.md) §5–8 for UI patterns and phased roadmap.

---

## 9. What to build next

### Phase 1 — Core UI (after TV episode gate passes)

1. **Home screen** — trending / popular rows from TMDB via API
2. **Search** — `GET /search?q=`
3. **Movie detail** — poster, synopsis, Play button → `resolveMovie` + `playSources`
4. **TV detail** — seasons, episode list, play → `resolveTvEpisode`
5. **Spatial focus** — extend `focus.js` for grid + horizontal rows
6. **Loading / error states** — surface API `warnings` in UI

### Phase 2 — Polish

1. Hero banner with auto-rotating featured title
2. Continue watching row (needs progress store)
3. Subtitle toggle
4. Quality indicator (from HLS `LEVEL_LOADED`)
5. Upgrade TizenBrew package to `packageType: "app"`

### Phase 3 — Account & sync

1. Appwrite auth (email or magic link)
2. Progress sync across devices
3. Watchlist

### Optional hardening

- [ ] 30+ minute continuous play test
- [ ] Stop → replay same title
- [ ] Web Audio gain slider for quiet sources
- [ ] Provider health dashboard (`provider-health` store exists in API)
- [ ] CI: `vitest` for proxy/rewrite; gate smoke on LAN samples

---

## 10. Go / no-go checklist

Run on Samsung TV; record in [`tizenflix-app/RESULTS.md`](../tizenflix-app/RESULTS.md).

### Required for **GO** (full UI build)

- [x] API health from TV
- [x] LAN MP4 plays
- [x] LAN HLS plays
- [x] Inception plays with picture + sound
- [ ] Off Campus S1E1 plays with picture + sound
- [x] Play / Pause works
- [x] Back key received
- [ ] 10+ minutes without fatal HLS error (recommended)

### Known blockers (not app bugs)

- Hydrogen CDN 403 — skip via validation; API ranks playable providers automatically
- `/play` slower than `/health` — resolves upstream providers; client timeout is 90s
- Oxygen max ~540p height for some titles
- Quality picker UI not built yet — hooks exist (`auto` / `high` / `medium` / `low`)
- Quiet audio — source limitation

### Commands to refresh after code changes

```bash
# API
cd tizenflix-api
PUBLIC_BASE=http://<LAN-IP>:8790 PORT=8790 npm run api

# App
cd tizenflix-app
npm run build && npm start
```

On TV: re-add GitHub module or bump release tag so TizenBrew fetches the new bundle.

---

## Summary

The gate test proved that **TizenBrew + LAN API + proxied HLS.js** is a viable foundation for Tizenflix. The hardest problems were Tizen-specific (`safePlay`, native HLS limits, CSS compatibility) and CDN-side (403 HTML masquerading as m3u8, demuxed masters). The player and API layers are now structured so the full Netflix-style UI can call the same `resolve*` + `playSources` path for both movies and TV episodes.

**Next step:** Run **Off Campus S1E1** on the TV. If it passes, start Phase 1 UI on top of `player.js` and `config.js`.
