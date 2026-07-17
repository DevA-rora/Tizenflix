# Tizenflix

Netflix-style streaming for Samsung TVs via [TizenBrew](https://github.com/reisxd/TizenBrew). Educational purposes only.

## 🧪 HLS Test Mode Active

The TV app is currently configured to run **HLS.js diagnostics** instead of the full application. This helps identify whether playback issues are caused by HLS.js compatibility or stream URL problems.

**Quick Commands:**
```bash
cd tizenflix-app
npm run prod-mode    # Switch back to full app
npm run test-mode    # Switch to test page (current)
```

📖 See [QUICK_HLS_TEST.md](QUICK_HLS_TEST.md) for complete guide.

---

## Repository layout

```
Tizenflix/
├── tizenflix-app/     # TizenBrew TV client (SPA) — start here for the TV app
├── tizenflix-api/     # Stream resolver + TMDB catalog + proxy + downloads
├── lab/               # Legacy experiments (Vidking iframe tests, old harness)
└── docs/              # Research and TV setup guides
```

| Package | What it does | Quick start |
|---------|--------------|-------------|
| **tizenflix-app** | Web UI loaded by TizenBrew on your TV | `cd tizenflix-app && npm start` |
| **tizenflix-api** | Backend the TV talks to over LAN | `cd tizenflix-api && npm run api` |
| **lab** | Old proof-of-concept pages (archived) | `cd lab && npm start` |

## First-time TV test (summary)

1. Install **TizenBrew** on your Samsung TV (see [docs/tv-setup.md](docs/tv-setup.md)).
2. On your PC, run **tizenflix-api** with `PUBLIC_BASE=http://<your-LAN-IP>:8790`.
3. On your PC, run **tizenflix-app** dev server (`npm start` → port 3010).
4. Add the app to TizenBrew on your TV (LAN dev or npm — full steps in [docs/tv-setup.md](docs/tv-setup.md)).
5. Confirm video plays from your API in the on-TV player.

You do **not** need a polished UI or npm publish for the first LAN test.

## Docs

- [TV setup & gate test explained](docs/tv-setup.md)
- [TizenBrew research & build plan](docs/tizenbrew-app-research.md)
- [API reference](tizenflix-api/api_info.md)
- [**TV Playback Fix - CDN Rate Limiting Solution**](TV_PLAYBACK_FIX_SUMMARY.md) ← **NEW**

## Troubleshooting

### TV Shows "All Sources Failed" Error
See [TV_PLAYBACK_FIX_SUMMARY.md](TV_PLAYBACK_FIX_SUMMARY.md) for comprehensive CDN rate limiting fix that addresses:
- HTTP 429 (Too Many Requests) errors
- TV-specific hls.js optimization
- Request deduplication and caching improvements
- Monitoring and debugging tools
