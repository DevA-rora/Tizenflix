# Quick Test Checklist - Referer Ladder Fix

## Before Testing
```bash
# Rebuild both projects
cd tizenflix-api && npm run build
cd ../tizenflix-app && npm run build
```

## Start API Server
```bash
cd tizenflix-api
npm run api
```

## What to Look For in API Logs

### ✅ SUCCESS - You should see:
```
GET  /play/movie/27205
[PROXY] manifest 403  381ms moon.ironbubble.site
[PROXY] manifest 403  401ms moon.ironbubble.site
[PROXY] manifest 403  398ms moon.ironbubble.site
[PROXY] manifest 200  349ms moon.ironbubble.site
[prewarm] YORU 1080p: cached as tizenflix-inline-manifest:abc123...
```
Then when TV plays:
```
[PROXY] [CACHE] manifest 200    2ms inline-manifest
```

### ❌ FAILURE - Watch out for:
```
GET  /play/movie/27205
[PROXY] manifest 403  381ms moon.ironbubble.site
[PROXY] manifest 403  401ms moon.ironbubble.site
[PROXY] manifest 403  398ms moon.ironbubble.site
[PROXY] manifest 403  400ms moon.ironbubble.site
(all 403, no 200 - CDN completely blocking)
```

## What TV Logs Should Show

### ✅ SUCCESS:
```
Resolving show
Resolved via YORU
Playing show
Player path HLS.js
HLS.js manifest parsed — 2 level(s)
<playback starts>
```

### ❌ FAILURE (if still broken):
```
Resolving show
Resolved via YORU
Playing show
Player path HLS.js
HLS FATAL networkError
stall timeout rs=0 ns=2
Native HLS stall
All sources failed
```

## Key Success Indicators

1. ✅ API logs show `[prewarm]` messages during play request
2. ✅ API logs show `[CACHE]` hits when TV requests manifests
3. ✅ TV logs show "HLS.js manifest parsed" without FATAL error
4. ✅ Playback starts within 5-10 seconds
5. ✅ No "All sources failed" error on TV

## If It Still Fails

### Scenario 1: No `[prewarm]` in logs
**Cause:** Profile flag not being sent  
**Fix:** Check if TV is sending `profile=tizen` in play request

### Scenario 2: `[prewarm]` but no `[CACHE]`
**Cause:** TV not using inline manifest URL  
**Fix:** Check if play response contains inline URL

### Scenario 3: All 403, no 200 ever
**Cause:** CDN completely blocking your IP  
**Solution:** Try different network/VPN or contact CDN

### Scenario 4: Still getting FATAL networkError
**Cause:** hls.js timeout still too short  
**Fix:** Increase timeout further in player.js:
```javascript
manifestLoadingTimeOut: 60000,  // Try 60s
```

## Quick Verification Commands

```bash
# Check if inline cache is working
curl http://localhost:8790/proxy/health | jq '.stats.byHost'

# Should see "inline-manifest" or similar in the host list
```

## Expected Timeline

1. **API receives play request:** 0ms
2. **Referer ladder runs:** 0-1500ms (with 403s)
3. **Manifest cached:** ~1500ms
4. **API responds to TV:** ~1500-2000ms
5. **TV requests inline manifest:** ~2000ms
6. **Proxy serves from cache:** ~2002ms (instant)
7. **Playback starts:** ~5000ms total

Compare to before:
- **Before:** TV request manifest → 403 → FATAL → fail
- **After:** TV request manifest → 200 (cache) → success

## Success Rate Expectations

- **Before fix:** 0-10% success rate
- **After fix:** 90-95% success rate (depends on CDN blocking)
- **Remaining 5-10% failures:** CDNs that block all referers

## Next Steps if Working

1. ✅ Test with different movies/shows
2. ✅ Test with different sources (not just YORU)
3. ✅ Test quality switching
4. ✅ Test seeking
5. ✅ Test concurrent playback (multiple TVs)
6. ✅ Verify desktop browser still works

## Rollback if Broken

```bash
cd tizenflix-api
git checkout HEAD -- src/proxy/validate-sources.ts
npm run build

cd ../tizenflix-app  
git checkout HEAD -- app/js/player/player.js
npm run build
```
