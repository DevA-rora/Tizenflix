# Network Setup Status

**Date**: 2026-07-16  
**Your LAN IP**: `192.168.86.49`

## ✅ Configuration Complete

### 1. API Backend (Port 8790)
**File**: `tizenflix-api/.env`
```bash
PUBLIC_BASE=http://192.168.86.49:8790
```

**Status**: ✅ Configured correctly  
**Start command**: 
```bash
cd tizenflix-api
npm run api
```

**Expected output**:
```
Tizenflix API http://192.168.86.49:8790  ← Must show YOUR IP, not localhost!
```

### 2. App Frontend (Port 3010)
**File**: `package.json`
```json
"websiteURL": "http://192.168.86.49:3010/app/index.html"
```

**Status**: ✅ Configured correctly  
**Start command**:
```bash
cd tizenflix-app
npm run dev
```

**Expected output**:
```
App:   http://192.168.86.49:3010/app/index.html
Gate:  http://192.168.86.49:3010/app/gate/index.html
```

### 3. App Auto-detects API URL
The frontend app automatically derives the API URL from its own hostname:

**Logic in** `tizenflix-app/app/js/core/config.js`:
```javascript
function deriveDefaultApi() {
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    var host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return "http://" + host + ":" + API_PORT;  // API_PORT = "8790"
    }
  }
  return "http://localhost:" + API_PORT;
}
```

**Result**: When TV loads `http://192.168.86.49:3010/app/index.html`, the app automatically uses `http://192.168.86.49:8790` for API calls.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ Samsung TV (TizenBrew)                             │
│                                                     │
│  Loads: http://192.168.86.49:3010/app/index.html  │
│         ↓                                           │
│  Frontend App (React-like UI)                      │
│         ↓                                           │
│  Makes API calls to: http://192.168.86.49:8790    │
└─────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────┐
│ Your PC (192.168.86.49)                            │
│                                                     │
│  Port 3010: tizenflix-app (Frontend)               │
│  - Serves HTML/JS/CSS                              │
│  - UI components, player logic                     │
│                                                     │
│  Port 8790: tizenflix-api (Backend)                │
│  - /browse/* → TMDB catalog                        │
│  - /play/* → Resolve sources                       │
│  - /proxy/* → Proxy HLS manifests/segments         │
│  - Referer ladder, pre-warming, caching            │
└─────────────────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────┐
│ Upstream CDNs                                       │
│  - moon.ironbubble.site (Yoru provider)            │
│  - cdn1.1shows.app (Vidzee provider)               │
│  - Various other streaming CDNs                     │
└─────────────────────────────────────────────────────┘
```

## Why Two Ports?

This is a **standard client-server architecture**:

- **Port 3010** (Frontend): Static files (HTML/CSS/JS) served to the browser/TV
- **Port 8790** (Backend): Dynamic API that handles business logic, external API calls, proxying

**Benefits**:
- Frontend can be served by any static file server
- Backend handles sensitive operations (API keys, cookies, upstream headers)
- Backend can implement caching, rate limiting, request deduplication
- Separation of concerns (UI vs. API logic)

## Next Steps

### 1. Verify Both Servers Are Running

**Terminal 1** - API Backend:
```bash
cd tizenflix-api
npm run api
```

**Terminal 2** - App Frontend:
```bash
cd tizenflix-app
npm run dev
```

### 2. Test Connectivity

From your browser (or another device on same network):

**Test Frontend**:
```
http://192.168.86.49:3010/app/index.html
```
Should load the Tizenflix UI

**Test Backend**:
```
http://192.168.86.49:8790/browse/rows
```
Should return JSON with movie/TV rows

### 3. Deploy to TV (TizenBrew)

Since `package.json` websiteURL is now correct, the TV will load:
```
http://192.168.86.49:3010/app/index.html
```

The app will auto-detect and use:
```
http://192.168.86.49:8790 (API)
```

### 4. Manual API Override (Optional)

If you need to manually set the API URL on the TV:

**From TV browser dev console** (if accessible):
```javascript
localStorage.setItem('tizenflix.apiBase', 'http://192.168.86.49:8790');
location.reload();
```

Or add this to Settings screen in the app UI.

## Troubleshooting

### TV Can't Load App
**Symptom**: Blank screen or "Unable to load" error  
**Check**:
- Is `npm run dev` running in `tizenflix-app`?
- Can you access `http://192.168.86.49:3010/app/index.html` from your browser?
- Is TV on the same network?
- Firewall blocking port 3010?

### TV Loads App But "API Unavailable"
**Symptom**: App loads but shows "Cannot connect to API" or similar  
**Check**:
- Is `npm run api` running in `tizenflix-api`?
- Can you access `http://192.168.86.49:8790/browse/rows` from your browser?
- Firewall blocking port 8790?
- Check browser dev console on TV for CORS errors

### Still Getting manifestLoadError
**Symptom**: HLS.js FATAL networkError / manifestLoadError  
**Check**:
1. API logs show pre-warming? (Look for `[prewarm]` lines)
2. API logs show TV requesting inline manifests? (Look for `/proxy/inline-manifest/` requests)
3. Verify `PUBLIC_BASE` in `.env` is `http://192.168.86.49:8790` (NOT localhost)
4. Restart API server after changing `.env`

## IP Address Changed?

If your machine's IP changes (DHCP reassignment), run:

```bash
cd tizenflix-api
node scripts/fix-public-base.mjs
```

This will auto-detect your new IP and update both:
- `tizenflix-api/.env` (PUBLIC_BASE)
- You'll need to manually update `package.json` (websiteURL) and redeploy to TV

## Summary

✅ **package.json**: `http://192.168.86.49:3010/app/index.html`  
✅ **tizenflix-api/.env**: `PUBLIC_BASE=http://192.168.86.49:8790`  
✅ **App auto-detects API**: Derives from window.location.hostname + `:8790`  
✅ **Two ports by design**: 3010 = frontend, 8790 = backend  

Both servers must be running. TV loads app from 3010, app calls API at 8790.
