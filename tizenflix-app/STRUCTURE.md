# Tizenflix App — Directory Structure

> Layout for Phase 1 UI development. Gate test preserved at `app/gate/`.

## Overview

```
tizenflix-app/
├── package.json
├── README.md
├── STRUCTURE.md          ← this file
├── RESULTS.md            ← TV test checklist
├── TIZEN_COMPAT.md
├── scripts/
│   └── dev.mjs           ← LAN static server (:3010)
└── app/
    ├── index.html        ← Main app entry (TizenBrew appPath)
    ├── gate/
    │   └── index.html    ← Playback gate test (diagnostics)
    ├── css/
    │   ├── base.css      ← Reset, focus, buttons (shared)
    │   ├── ui.css        ← App shell, nav, screens
    │   ├── player.css    ← Video + playback bar (shared)
    │   └── gate.css      ← Gate-only panels/checklist
    ├── js/
    │   ├── app.js        ← Main bundle entry
    │   ├── core/
    │   │   ├── config.js     ← API base, resolve, quality prefs
    │   │   ├── focus.js      ← D-pad spatial navigation
    │   │   ├── debug.js      ← On-screen debug overlay
    │   │   └── router.js     ← Screen stack + Back key
    │   ├── player/
    │   │   └── player.js     ← HLS playback (shared)
    │   ├── services/
    │   │   └── api.js        ← Thin API client for screens
    │   ├── screens/
    │   │   ├── home.js
    │   │   ├── search.js
    │   │   ├── settings.js
    │   │   ├── detail-movie.js
    │   │   ├── detail-tv.js
    │   │   └── player.js
    │   ├── components/
    │   │   ├── row.js
    │   │   ├── card.js
    │   │   └── episode-list.js
    │   └── gate/
    │       └── main.js       ← Gate bundle entry
    ├── dist/
    │   ├── app.bundle.js
    │   └── gate.bundle.js
    └── lib/
        └── hls.min.js
```

## URLs (dev server)

| Page | URL |
|------|-----|
| **Main app** | `http://<LAN-IP>:3010/app/index.html` |
| **Gate test** | `http://<LAN-IP>:3010/app/gate/index.html` |

TizenBrew `websiteURL` / `appPath` should point at the **main app** (`app/index.html`).

## Build

```bash
npm run build        # both bundles
npm run build:app    # app.bundle.js only
npm run build:gate   # gate.bundle.js only
```

## Where to add UI code

| Feature | Location |
|---------|----------|
| New screen | `app/js/screens/<name>.js` → register in `app.js` |
| Reusable UI | `app/js/components/` |
| API calls | `app/js/services/api.js` (extend as needed) |
| Screen styles | `app/css/ui.css` (+ component-specific rules) |
| Playback | `app/js/player/player.js` (do not fork) |

## Gate test

The gate test is unchanged in behavior — only moved to `app/gate/`. Use it when debugging playback on TV without touching the main UI.
