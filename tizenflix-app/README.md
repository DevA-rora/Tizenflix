# Tizenflix App

TizenBrew client for Samsung TVs. Talks to [tizenflix-api](../tizenflix-api) over your home network.

Educational purposes only.

## What this is

**v0.2** — UI scaffold + proven playback layer. The main app (`app/index.html`) is a Netflix-style shell ready for browse/detail screens. The **gate test** (`app/gate/index.html`) remains available for playback diagnostics.

See [STRUCTURE.md](STRUCTURE.md) for the full directory map.

## Local development

```bash
# Terminal 1 — API
cd ../tizenflix-api
PUBLIC_BASE=http://192.168.86.11:8790 npm run api

# Terminal 2 — App
cd ../tizenflix-app
npm install
npm start
```

| URL | Purpose |
|-----|---------|
| `http://<LAN-IP>:3010/app/index.html` | Main app (TizenBrew loads this) |
| `http://<LAN-IP>:3010/app/gate/index.html` | Gate playback test |

`npm start` builds both bundles then serves on `:3010`. See [TIZEN_COMPAT.md](TIZEN_COMPAT.md) for TV CSS/JS rules.

**After changing `app/js/**` source files, always run `npm run build` before testing on TV.** The TV loads `app/dist/app.bundle.js`, not the source tree. Confirm deployment by opening the debug overlay — you should see `Tizenflix build 0.2.1-speed-gap` and `Buffer primed 4s` (not 20s) during playback.

## TizenBrew package

| Field | Value |
|-------|-------|
| `packageType` | `app` |
| `appPath` | `app/index.html` |
| npm name | `@dev-arora/tizenflix` |

Full TV setup: [docs/tv-setup.md](../docs/tv-setup.md).

## Build

```bash
npm run build        # app + gate bundles
npm run build:app    # main UI only
npm run build:gate   # diagnostics only
```

## Next: Phase 1 UI

1. Home — browse rows from API
2. Detail — movie / TV with Play
3. Player screen — wire `screens/player.js` to `player.playSources()`
4. Settings — quality, API URL (dev)

Architecture notes: [docs/gate-findings.md](../docs/gate-findings.md).
