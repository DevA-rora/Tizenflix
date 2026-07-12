# Tizenflix App

TizenBrew client for Samsung TVs. This package is the UI your TV loads — it talks to [tizenflix-api](../tizenflix-api) over your home network.

Educational purposes only.

## What this is right now

A **proof-of-streaming** page (`app/index.html`), not the final Netflix-style UI. It exists to confirm:

1. TizenBrew can load your app on the TV
2. The TV can reach `tizenflix-api` on your LAN
3. HLS playback works through the API proxy

Once the gate checklist passes on real hardware, we build rows, hero banners, and animations on top of this.

## Local development

```bash
# Terminal 1 — API (set LAN IP, not localhost)
cd ../tizenflix-api
cp .env.example .env   # add TMDB_API_KEY
PUBLIC_BASE=http://192.168.1.XX:8790 npm run api

# Terminal 2 — App static server (binds 0.0.0.0:3010)
cd ../tizenflix-app
npm start
```

Open `http://localhost:3010/app/index.html` in a browser first. Then use the LAN URL printed in the terminal on your TV.

## TizenBrew package

| Field | Value |
|-------|-------|
| `packageType` | `app` |
| `appPath` | `app/index.html` |
| npm name | `@dev-arora/tizenflix` |

Full TV setup steps: [docs/tv-setup.md](../docs/tv-setup.md).

## Testing on TV before npm publish

You **do not** need to publish to npm for the first test. Use the LAN dev workflow in `docs/tv-setup.md` (TizenBrew loads your PC's dev server over Wi‑Fi).

When ready for a persistent install:

```bash
npm publish --access public
```

On TV: TizenBrew → GREEN → add `@dev-arora/tizenflix`.

## Files

```
tizenflix-app/
├── package.json          # TizenBrew app module (production)
├── package.lan-dev.json  # Reference mods stub for LAN testing
├── app/
│   ├── index.html        # Entry point
│   ├── css/app.css
│   ├── js/               # config, player, focus
│   └── lib/hls.min.js
└── scripts/dev.mjs       # Dev static server
```
