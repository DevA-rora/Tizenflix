# 🎯 Quick HLS Test Reference

## Current Status
✅ **TEST MODE ACTIVE** - App will load HLS test page instead of full UI

## Deploy to TV

```bash
cd tizenflix-app
npm run build
# Deploy using TizenBrew (your normal method)
```

## What You'll See

📺 A test interface with 5 pre-configured streams
🎮 Works with TV remote (Play/Pause, FF/Rewind, D-pad)
📊 Debug log showing everything that happens

## Quick Diagnosis

| What Happens | Meaning | Next Step |
|--------------|---------|-----------|
| ✅ Test streams play | HLS.js works! | Fix API stream URLs |
| ⚠️ Only MP4 plays | No HLS support | Find providers with direct MP4 |
| ❌ Nothing plays | Codec issue | Check TV specs |
| 🌐 Network errors | CORS/blocking | Check stream accessibility |

## Switch Back

```bash
cd tizenflix-app
npm run prod-mode
npm run build
# Redeploy
```

## Detailed Docs

- `tizenflix-app/TEST_MODE_README.md` - Complete guide
- `tizenflix-app/HLS_TEST_MODE.md` - Technical details
- `HLS_TEST_SETUP.md` - Quick start

## Test Page Location

`tizenflix-app/app/hls-test.html` - Self-contained, no build needed

The test page uses known-good HLS streams to isolate whether the problem is:
1. HLS.js compatibility ← Test page checks this
2. Stream URL quality ← If test works but yours don't, it's this
3. Network/CORS issues ← Shows clear errors
4. Codec support ← MP4 test establishes baseline

Deploy and watch the on-screen logs. You'll know immediately what's working.
