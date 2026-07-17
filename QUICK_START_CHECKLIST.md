# Quick Start Checklist

## Before You Start

**Your IP**: `192.168.86.49`

## Step-by-Step Launch

### 1. Start API Backend (Terminal 1)
```bash
cd ~/Code/01_building/Tizenflix/tizenflix-api
npm run api
```

**✅ Look for**:
```
Tizenflix API http://192.168.86.49:8790  ← MUST show 192.168.86.49, NOT localhost!
```

**❌ If you see localhost**:
```bash
# Stop server (Ctrl+C), then:
node scripts/fix-public-base.mjs
npm run api
```

### 2. Start App Frontend (Terminal 2)
```bash
cd ~/Code/01_building/Tizenflix/tizenflix-app
npm run dev
```

**✅ Look for**:
```
App:   http://192.168.86.49:3010/app/index.html
Gate:  http://192.168.86.49:3010/app/gate/index.html
```

### 3. Test in Browser (Your Computer)
Open: `http://192.168.86.49:3010/app/index.html`

**✅ Should see**: Tizenflix UI loads, shows movies/TV shows  
**❌ If blank**: Check browser console for errors

### 4. Test on TV (TizenBrew)
**Option A**: Navigate to Tizenflix app in TizenBrew launcher  
**Option B**: Open TV browser → `http://192.168.86.49:3010/app/index.html`

### 5. Try Playing Something
1. Select a movie/show
2. Press play
3. Watch API terminal for logs

**✅ Good logs**:
```
[prewarm] Yoru 1080p: cached as tizenflix-inline-manifest:abc123...
GET /proxy/inline-manifest/abc123?profile=tizen
```

**❌ Bad logs** (not seeing inline-manifest requests):
- TV might be using old cached API URL
- Try: Settings → Clear App Data → Reload

## Quick Troubleshooting

### "Cannot connect to API"
- [ ] Is API server running? (Terminal 1)
- [ ] Can you access `http://192.168.86.49:8790/browse/rows` in browser?
- [ ] Firewall blocking port 8790?

### "HLS.js FATAL manifestLoadError"
- [ ] Is PUBLIC_BASE set to `192.168.86.49:8790` in `tizenflix-api/.env`?
- [ ] Did you restart API after changing .env?
- [ ] Check API logs for `[prewarm]` messages
- [ ] Check API logs for `/proxy/inline-manifest/` requests

### "App won't load on TV"
- [ ] Is app server running? (Terminal 2)
- [ ] Can you access `http://192.168.86.49:3010/app/index.html` in browser?
- [ ] Is TV on same WiFi network?
- [ ] Firewall blocking port 3010?

## All Fixes Applied ✅

1. ✅ Response cloning bug fixed (no more "Body has already been consumed")
2. ✅ `profile=tizen` parameter passed to inline manifests (2-rung optimization)
3. ✅ `PUBLIC_BASE` set to actual IP (TV can reach API)
4. ✅ `package.json` websiteURL updated to actual IP

## Expected Behavior

When playing a video:
1. TV loads app from `http://192.168.86.49:3010/app/index.html`
2. App requests play info from `http://192.168.86.49:8790/play/movie/27205?profile=tizen`
3. API validates sources (403→403→403→200 referer ladder)
4. API pre-warms manifests: `[prewarm] Yoru 1080p: cached...`
5. API returns inline manifest URLs: `http://192.168.86.49:8790/proxy/inline-manifest/abc123?profile=tizen`
6. TV's HLS.js requests manifest from API
7. API serves cached, optimized 2-rung manifest
8. HLS.js loads successfully
9. Playback starts! 🎉

## Monitor Both Terminals

Keep both terminals visible while testing:

**Terminal 1** (API):
- Watch for `[prewarm]` messages (good!)
- Watch for `/proxy/inline-manifest/` requests (good!)
- Watch for 403→200 pattern (referer ladder working)
- Watch for validation errors (bad - needs investigation)

**Terminal 2** (App):
- Should be mostly quiet during playback
- Watch for HTTP requests and status codes
- Check for any build errors

## If Your IP Changes

Run this to auto-update:
```bash
cd ~/Code/01_building/Tizenflix/tizenflix-api
node scripts/fix-public-base.mjs
```

Then restart both servers and reload TV app.
