# Testing Guide - TV Playback Fix

## Quick Start

### 1. Rebuild Both Projects
```bash
# API
cd tizenflix-api
npm run build

# App
cd ../tizenflix-app
npm run build
```

### 2. Start the API Server
```bash
cd tizenflix-api
npm run api
```

You should see output like:
```
[PROXY] manifest 200   85ms videasy.to
[PROXY] [CACHE] manifest 200    2ms videasy.to
```

### 3. Start the App Dev Server (if testing locally)
```bash
cd tizenflix-app
npm start
```

### 4. Test on Desktop Browser First
1. Open http://localhost:3010 (or your dev server URL)
2. Play any movie/show
3. Check browser console for:
   - "Player path: HLS.js — priming buffer..."
   - "HLS.js manifest parsed — 3 level(s)" (desktop gets 3 rungs)
   - Playback should start smoothly

### 5. Monitor Proxy Health
Open another terminal:
```bash
# Watch proxy statistics in real-time
watch -n 2 'curl -s http://localhost:8790/proxy/health | jq'
```

You should see:
- `rateLimitRate: "0%"` or very low percentage
- `cacheHitRate` increasing over time
- No hosts with high `rateLimited` counts

### 6. Test on TV
1. Deploy to your TV (via TizenBrew)
2. Play any movie/show
3. Expected behavior:
   - Video starts within 5-10 seconds
   - No "All sources failed" error
   - Smooth playback

### 7. Check API Logs During TV Playback
Watch for these patterns:

#### ✅ GOOD (What you want to see):
```
[PROXY]        manifest 200   95ms moon.ironbubble.site
[PROXY] [CACHE] manifest 200    3ms moon.ironbubble.site
[PROXY]        segment  200  180ms moon.ironbubble.site
[PROXY]        segment  200  195ms moon.ironbubble.site
[PROXY]        segment  200  185ms moon.ironbubble.site
```
- Cached manifests (reduces upstream requests)
- Segments spaced ~200-300ms apart
- No 429 errors

#### ❌ BAD (If you see this, something's wrong):
```
[PROXY] [429]  manifest 429  150ms moon.ironbubble.site
[PROXY] ⚠️  Rate limited (429) from moon.ironbubble.site
[PROXY] ⚠️  Client 192.168.1.100 made 52 requests in 10s
```
- Multiple 429 errors
- High request rate (>50 req/10s)

## Detailed Testing Scenarios

### Scenario 1: Fresh Stream Start
**Expected:**
1. First manifest fetch takes 80-150ms (network)
2. Quality rungs fetched (1-2 requests)
3. First segment loads
4. Subsequent segments load progressively
5. Manifest requests served from cache after first fetch

### Scenario 2: Quality Switching
**Expected:**
1. No burst of segment requests
2. Smooth transition between qualities
3. Buffer maintained during switch

### Scenario 3: Seeking
**Expected:**
1. Quick seek response (<1s)
2. Buffer refills progressively
3. No 429 errors from burst segment requests

### Scenario 4: Multiple Concurrent Streams
**Desktop + TV simultaneously:**

**Expected:**
- Request deduplication prevents duplicate fetches
- Cache shared between clients
- No rate limiting even with 2 active streams

## Debugging Commands

### Check Request Rate
```bash
# Count requests in last 10 seconds
curl -s http://localhost:8790/proxy/health | jq '.stats.last10Seconds'
```

### Check Cache Efficiency
```bash
# Get cache hit rate
curl -s http://localhost:8790/proxy/health | jq '.stats.cacheHitRate'
```

### Check for Rate Limiting
```bash
# Get rate limit percentage
curl -s http://localhost:8790/proxy/health | jq '.stats.rateLimitRate'
```

### Check Per-Host Statistics
```bash
# See which hosts are being rate limited
curl -s http://localhost:8790/proxy/health | jq '.stats.byHost'
```

## Common Issues & Solutions

### Issue: Still Getting 429 Errors

**Solution 1: Increase Cache TTL**
Edit `tizenflix-api/src/proxy/upstream.ts`:
```typescript
const MASTER_MANIFEST_CACHE_TTL_MS = 600_000; // 10 minutes (was 300s)
const MEDIA_MANIFEST_CACHE_TTL_MS = 30_000;   // 30 seconds (was 10s)
```

**Solution 2: Reduce Quality Rungs Further**
Edit `tizenflix-api/src/proxy/rewrite-m3u8.ts`:
```typescript
const maxRungs = options.tizenProfile ? 1 : (options.maxRungs ?? 3);
```

**Solution 3: Increase Backoff Delays**
Edit `tizenflix-api/src/proxy/upstream.ts` in `fetchWithRateLimitHandling`:
```typescript
let waitMs = Math.min(2000 * Math.pow(2, retryCount), 16000); // 2s, 4s, 8s, 16s
```

### Issue: Cache Hit Rate Too Low

**Check:**
1. Are manifests actually cacheable? (check CDN headers)
2. Is cache being cleared too early?
3. Are clients using different query parameters?

**Solution:**
```bash
# Check cache status
curl -s http://localhost:8790/proxy/health | jq '.stats'
```

### Issue: TV Buffering/Stuttering

**Possible cause:** Buffer sizes too small

**Solution:** Edit `tizenflix-app/app/js/player/player.js`:
```javascript
// Increase buffer slightly if TV hardware can handle it
maxBufferLength: 30,  // was 20
maxMaxBufferLength: 90,  // was 60
```

### Issue: Slow Startup on TV

**Check hls.js logs:**
```javascript
// Add to player.js temporarily for debugging:
console.log('HLS.js config:', hlsInstance.config);
```

**Verify:**
- `startFragPrefetch: false` for TV
- `maxBufferLength: 20` for TV
- Manifest parsing succeeds quickly

## Performance Benchmarks

### Desktop Browser (Expected)
- Time to first frame: 2-4 seconds
- Buffer fill rate: 10-15 segments/second
- Cache hit rate after 1 minute: 40-60%
- Rate limit rate: 0%

### TV (Expected)
- Time to first frame: 5-10 seconds (slower due to reduced prefetch)
- Buffer fill rate: 3-5 segments/second (intentionally slower)
- Cache hit rate after 1 minute: 30-50%
- Rate limit rate: 0%

## Success Criteria

✅ **Must Have:**
- [ ] TV playback starts successfully
- [ ] No 429 errors in logs
- [ ] Playback completes without interruption
- [ ] Rate limit rate < 2%

✅ **Should Have:**
- [ ] Cache hit rate > 20% after 1 minute
- [ ] Time to first frame < 10 seconds on TV
- [ ] Smooth seeking without buffering
- [ ] Multiple concurrent streams work

✅ **Nice to Have:**
- [ ] Cache hit rate > 40% after 5 minutes
- [ ] Quality switching without buffering
- [ ] Works across different CDN providers

## Rollback Plan

If the fix causes issues:

```bash
# Quick rollback
cd /home/dev-arora/Code/01_building/Tizenflix
git diff HEAD > tv-fix-backup.patch
git checkout HEAD -- tizenflix-api/src/proxy/
git checkout HEAD -- tizenflix-app/app/js/player/
cd tizenflix-api && npm run build
cd ../tizenflix-app && npm run build

# To reapply later:
git apply tv-fix-backup.patch
```

## Reporting Issues

If you encounter problems, collect this information:

1. **API Logs** (full output from when TV starts playing)
2. **Proxy Health Stats**:
   ```bash
   curl http://localhost:8790/proxy/health > proxy-stats.json
   ```
3. **TV Browser Console** (if accessible via Tizen remote debugging)
4. **Specific error messages** shown on TV screen
5. **Source provider** that failed (Videasy, Vidsrc, etc.)

Include all of this in your bug report along with:
- TV model and Tizen version
- Network setup (WiFi vs Ethernet, router model)
- Time of day (CDN rate limits may be time-dependent)
