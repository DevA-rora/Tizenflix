# Lab (legacy experiments)

> **Superseded by [`tizenflix-app`](../tizenflix-app/)** — use that for TV development. This folder is kept for early Vidking iframe tests and the old tmdb-embed-api harness.

Legacy TizenBrew / playback experiments (educational purposes only).

## Playback test harness

Before building the full app, validate playback on your TV:

1. **Vidking iframe** — embed-only API, postMessage progress events
2. **Direct streams** — `.mp4` / `.m3u8` via self-hosted [tmdb-embed-api](https://github.com/inside4ndroid/tmdb-embed-api)
3. **Custom player** — own `<video>` + hls.js + OpenSubtitles subtitles

### Setup

```bash
npm start
# Open http://localhost:3000
```

**No API keys required** for Vidking iframe tests and demo MP4/HLS streams.

### Optional: full stream resolver + subtitles

```bash
cp .env.example .env
# Add TMDB_API_KEY and OPENSUBTITLES_API_KEY

docker compose up -d
npm start
```

### Test pages

| Page | URL |
|------|-----|
| Hub | `/index.html` |
| Vidking iframe | `/vidking-iframe.html` |
| Vidking params | `/vidking-params.html` |
| Stream fetch | `/stream-fetch.html` |
| Custom player | `/custom-player.html` |
| TV gate test | `/gate-test.html` |

### CLI

```bash
node scripts/fetch-streams.mjs movie 27205
node scripts/fetch-streams.mjs series 1396 1 1
curl http://localhost:8787/api/health
curl http://localhost:8788/api/health
```

### tmdb-embed-api admin

Open http://localhost:8787/ after first run. Enable providers and set `enableProxy: true` if streams fail due to CORS.

### TV testing (no npm publish)

1. Enable GitHub Pages on this repo (serve from `/tests` or root with `tests/` path)
2. Update `websiteURL` in `package.json` with your GitHub Pages URL
3. On TV: TizenBrew → Module Manager → Add → GitHub → `youruser/tizenflix`
4. For gate test B on TV, enter your PC's LAN IP in the API host field (e.g. `http://192.168.1.10:8787`)

Record results in [tests/RESULTS.md](tests/RESULTS.md).

### TizenBrew module (dev)

```json
{
  "packageType": "mods",
  "websiteURL": "https://YOUR_USER.github.io/tizenflix/tests/gate-test.html?v=1",
  "main": "tests/noop.js"
}
```

Bump `?v=` after each deploy to bust cache.