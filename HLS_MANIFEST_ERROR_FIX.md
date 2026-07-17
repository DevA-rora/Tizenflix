# HLS.js FATAL networkError / manifestError - Fix Implementation

## Date: 2026-07-16

## Problem Summary

The TV player was experiencing `HLS.js FATAL networkError / manifestError` despite:
- Successful referer ladder completion (403→403→403→200)
- Manifest pre-warming working correctly
- API logs showing manifests being cached

API logs showed:
```
[prewarm] Yoru 1080p: cached as tizenflix-inline-manifest:30259b377faf4b6a...
[validate] Vidzee/Nflix (Vidzee) Nflix (Vidzee): unverified (Response.clone: Body has already been consumed.)
```

## Root Causes Identified

### 1. **Missing `profile=tizen` Parameter on Inline Manifest URLs**

**Issue:** The inline manifest pre-warming system was correctly caching manifests, but when serving them back to the TV, the `profile=tizen` query parameter was NOT being passed through the URL. This meant:
- TV was getting full 3-quality-rung manifests instead of simplified 2-rung manifests
- More manifest requests = higher CDN rate limit risk
- No TV-specific optimizations were being applied

**Files Affected:**
- `tizenflix-api/src/server/register-routes.ts` - `proxyWrap()` and `withProxiedUrls()` functions

**Fix:**
- Added `tizenProfile` parameter to `proxyWrap()` function
- Added `tizenProfile` parameter to `withProxiedUrls()` function
- Pass `profile=tizen` query parameter in inline manifest URLs when `tizenProfile=true`
- Ensured all `/play` endpoint calls pass through the `tizenProfile` flag to URL generation

### 2. **Request Deduplication Response Clone Bug**

**Issue:** The request deduplication system had a critical bug where:
1. First caller receives the original Response object
2. That Response body gets consumed (e.g., `.text()` called)
3. Subsequent callers waiting on the same request receive `.clone()` of an already-consumed Response
4. This causes `Response.clone: Body has already been consumed` errors
5. Sources fail validation even though the manifest was successfully fetched

This is why we saw validation failures with "unverified (Response.clone: Body has already been consumed.)"

**Files Affected:**
- `tizenflix-api/src/proxy/request-deduplication.ts` - `deduplicatedFetch()` function

**Fix:**
- Clone the Response IMMEDIATELY when it arrives, before storing in pending map
- Return a clone to the initial caller (not the original)
- Store the cloned version so subsequent waiters can also clone it
- Now ALL callers (initial + waiters) receive independently readable Response clones

## Changes Made

### File: `tizenflix-api/src/server/register-routes.ts`

#### Change 1: Updated `proxyWrap()` signature
```typescript
function proxyWrap(
  publicBase: string,
  url: string,
  headers?: ProxyHeaderParams,
  audioLang?: string,
  maxHeight?: number,
  tizenProfile = false  // NEW PARAMETER
): string {
  if (isInlineManifestSource(url)) {
    const token = url.slice("tizenflix-inline-manifest:".length);
    let inlineUrl = `${publicBase.replace(/\/$/, "")}/proxy/inline-manifest/${token}`;
    const params = new URLSearchParams();
    if (audioLang) params.set("audioLang", audioLang);
    if (maxHeight && maxHeight > 0) params.set("maxHeight", String(maxHeight));
    if (tizenProfile) params.set("profile", "tizen");  // NEW LINE
    const qs = params.toString();
    if (qs) inlineUrl += `?${qs}`;
    return inlineUrl;
  }
  return buildProxyUrl(publicBase, url, headers, audioLang, maxHeight);
}
```

#### Change 2: Updated `withProxiedUrls()` signature
```typescript
function withProxiedUrls(
  publicBase: string,
  play: Awaited<ReturnType<typeof resolvePlayableSources>>,
  preferredAudioLang?: string,
  maxHeight?: number,
  tizenProfile = false  // NEW PARAMETER
) {
  const audioLang =
    preferredAudioLang ?? play.audioPreference?.targetLanguage ?? undefined;
  return {
    ...play,
    sources: play.sources.map((s) => ({
      ...s,
      url: proxyWrap(publicBase, s.url, proxyHeadersFromSource(s), audioLang, maxHeight, tizenProfile),
    })),
    subtitles: play.subtitles.map((sub) => ({
      ...sub,
      url: sub.url ? proxyWrap(publicBase, sub.url, undefined, audioLang, maxHeight, tizenProfile) : sub.url,
    })),
  };
}
```

#### Change 3: Pass `tizenProfile` through in play endpoint
```typescript
// Both skipValidation and validation paths now pass tizenProfile
res.json(
  withProxiedUrls(
    publicBase,
    validated,
    play.audioPreference?.targetLanguage,
    options.maxHeight,
    tizenProfile  // NEW PARAMETER
  )
);
```

### File: `tizenflix-api/src/proxy/request-deduplication.ts`

#### Change: Clone responses immediately to prevent body consumption errors
```typescript
export async function deduplicatedFetch(
  url: string,
  fetchFn: () => Promise<globalThis.Response>,
  headers?: HeadersInit
): Promise<globalThis.Response> {
  const key = createRequestKey(url, headers);
  const existing = pendingRequests.get(key);

  if (existing) {
    console.log(`[DEDUP] Waiting for in-flight request: ${url.substring(0, 80)}`);
    try {
      const response = await existing.promise;
      return response.clone();
    } catch (err) {
      pendingRequests.delete(key);
      throw err;
    }
  }

  // NEW: Clone immediately when response arrives
  const promise = fetchFn().then(res => {
    return res.clone();
  });
  
  pendingRequests.set(key, {
    promise,
    timestamp: Date.now(),
  });

  try {
    const response = await promise;
    setTimeout(() => pendingRequests.delete(key), 100);
    // NEW: Return clone so stored version remains readable
    return response.clone();
  } catch (err) {
    pendingRequests.delete(key);
    throw err;
  }
}
```

## Expected Behavior After Fix

### Before Fix:
```
TV requests /play?profile=tizen
  ↓
API pre-warms manifest (referer ladder runs during validation)
  ↓
API returns: tizenflix-inline-manifest:abc123...
  ↓
TV requests: /proxy/inline-manifest/abc123
  ❌ Missing ?profile=tizen
  ↓
Manifest served with 3 quality rungs (desktop config)
  ↓
More concurrent requests → Rate limiting → HLS.js FATAL
```

### After Fix:
```
TV requests /play?profile=tizen
  ↓
API pre-warms manifest (referer ladder runs during validation)
  ↓
API returns: tizenflix-inline-manifest:abc123...
  ↓
TV requests: /proxy/inline-manifest/abc123?profile=tizen
  ✅ profile=tizen present
  ↓
Manifest served with 2 quality rungs (TV optimized)
  ↓
Fewer requests → Less rate limiting → Playback succeeds
```

### Deduplication Fix:
```
Multiple concurrent requests for same manifest
  ↓
First request fetches upstream
  ↓
Response cloned immediately
  ↓
All callers (initial + waiters) get readable clones
  ✅ No "Body has already been consumed" errors
  ↓
All sources validate successfully
```

## Testing

### 1. Rebuild the API
```bash
cd tizenflix-api
npm run build
```

### 2. Start the API Server
```bash
npm run api
```

### 3. Monitor API Logs
Look for:
- ✅ Pre-warming success: `[prewarm] Provider Quality: cached as tizenflix-inline-manifest:...`
- ✅ NO validation errors: `[validate] ... unverified (Response.clone: Body has already been consumed.)`
- ✅ Successful manifest fetches after referer ladder
- ✅ Deduplication working without errors

### 4. Test on TV
- Navigate to a movie/show
- Start playback
- Should see:
  - Faster startup (fewer manifest requests)
  - No "All sources failed" errors
  - Successful HLS.js playback without FATAL errors

## Technical Details

### Why `profile=tizen` Matters

The inline manifest endpoint (`/proxy/inline-manifest/:token`) checks for `req.query.profile === "tizen"` to:
1. Reduce quality rungs from 3 to 2 (via `simplifyMasterForTv()`)
2. Apply TV-specific manifest optimizations
3. Reduce concurrent requests to CDNs
4. Minimize rate limiting risk

Without this parameter, TV gets the same manifest as desktop, defeating the purpose of the TV-specific configuration in `player.js`.

### Why Response Cloning Failed

JavaScript Response objects are single-use by design. Once you call `.text()` or `.arrayBuffer()`, the body stream is consumed and cannot be read again. The `.clone()` method creates a new Response with a separate body stream, but it must be called BEFORE the original is consumed.

The deduplication bug was:
1. Store original Response in map
2. First caller receives original → calls `.text()` → consumes body
3. Second caller receives `.clone()` of already-consumed Response → ERROR

Fix:
1. Receive Response from fetch
2. **Immediately clone it before storing**
3. Store the clone in map
4. Return another clone to initial caller
5. Subsequent callers clone the stored version
6. All callers have independent, readable Response objects

## Related Files

- `tizenflix-api/src/proxy/validate-sources.ts` - Where pre-warming happens
- `tizenflix-api/src/cache/inline-manifest-cache.ts` - Inline manifest storage (30min TTL)
- `tizenflix-api/src/proxy/upstream.ts` - Referer ladder implementation
- `tizenflix-api/src/proxy/rewrite-m3u8.ts` - Manifest simplification logic
- `tizenflix-app/app/js/player/player.js` - TV HLS.js configuration

## Previous Fix Attempts

This builds on previous fixes documented in:
- `TV_PLAYBACK_FIX_SUMMARY.md` - TV-optimized HLS.js config, caching, rate limiting
- `REFERER_LADDER_FIX.md` - Manifest pre-warming to avoid referer ladder timeout

The missing pieces were:
1. Passing through the TV profile to inline manifest URLs
2. Fixing the response cloning bug in deduplication

## Success Criteria

✅ No "Response.clone: Body has already been consumed" errors in validation
✅ Inline manifest URLs include `?profile=tizen` when serving TV
✅ TV receives 2-rung manifests instead of 3-rung manifests
✅ HLS.js plays without FATAL networkError on TV
✅ Reduced CDN request count per playback session


---

## CRITICAL UPDATE: PUBLIC_BASE Configuration

### The Real Issue: localhost URLs

After implementing the above fixes, testing revealed the **actual root cause** of the manifestLoadError:

**The `PUBLIC_BASE` environment variable was set to `http://localhost:8790` (or auto-defaulting to localhost), which means:**
- API generates inline manifest URLs like: `http://localhost:8790/proxy/inline-manifest/abc123`
- TV app tries to load these URLs
- **`localhost` on the TV points to the TV itself, NOT your API server!**
- Result: HLS.js cannot fetch the manifest → `FATAL networkError / manifestLoadError`

### The Fix: Set PUBLIC_BASE to Your Machine's IP

**File:** `tizenflix-api/.env`

**Before:**
```bash
# PUBLIC_BASE is auto-detected by `npm run dev` (uses your LAN IP).
# Uncomment and set this to pin a specific address (e.g. for TV access on a fixed IP).
# PUBLIC_BASE=http://192.168.86.178:8790
```

**After:**
```bash
# PUBLIC_BASE is auto-detected by `npm run dev` (uses your LAN IP).
# Uncomment and set this to pin a specific address (e.g. for TV access on a fixed IP).
# IMPORTANT: Replace with your actual machine's IP address (not localhost!)
PUBLIC_BASE=http://YOUR_ACTUAL_IP:8790
```

### How to Find Your IP Address

**Option 1: Use the detection script**
```bash
cd tizenflix-api
bash scripts/detect-ip.sh
```

**Option 2: Manual detection**
```bash
# Linux
ip addr show

# Or
hostname -I

# Look for an address like 192.168.x.x or 10.x.x.x
```

**Option 3: Check router admin page**
- Look for your device in connected devices list

### Example Configuration

If your machine's IP is `192.168.1.100`:
```bash
PUBLIC_BASE=http://192.168.1.100:8790
```

### After Updating .env

1. **Restart the API server** (the old process must be stopped)
```bash
# Stop the current server (Ctrl+C in the terminal)
npm run api
```

2. **Verify the correct URL is shown** in startup logs:
```
Tizenflix API http://192.168.1.100:8790  ← Should show YOUR IP, not localhost!
```

3. **Test from TV** - The TV should now be able to load manifests successfully

### Why This Matters

The inline manifest pre-warming system creates URLs using `publicBase`:
```typescript
// In proxyWrap():
if (isInlineManifestSource(url)) {
  const token = url.slice("tizenflix-inline-manifest:".length);
  let inlineUrl = `${publicBase}/proxy/inline-manifest/${token}`;  // ← publicBase must be accessible from TV!
  // ...
}
```

If `publicBase` is `http://localhost:8790`, the TV receives:
```json
{
  "sources": [
    {
      "url": "http://localhost:8790/proxy/inline-manifest/abc123?profile=tizen"
    }
  ]
}
```

The TV tries to load `localhost:8790` which doesn't exist on the TV → network error.

With correct `publicBase` (`http://192.168.1.100:8790`), the TV receives:
```json
{
  "sources": [
    {
      "url": "http://192.168.1.100:8790/proxy/inline-manifest/abc123?profile=tizen"
    }
  ]
}
```

The TV can reach `192.168.1.100:8790` over the local network → manifest loads successfully!

### Adblock Note

Adblock should NOT affect this since:
- Requests are made from the TV app (not browser with adblock)
- They're to a local IP address (not typical ad domains)
- They're API requests, not ad scripts

However, if you're testing in a desktop browser with adblock enabled, some aggressive blockers might interfere with CORS requests or specific URL patterns. Test in an incognito/private window to rule this out.

### Network Requirements

For TV to reach API:
- ✅ TV and API server must be on the same local network
- ✅ No firewall blocking port 8790 on your machine
- ✅ TV can reach your machine's IP address

Test connectivity from TV:
```bash
# On TV (if possible) or another device on same network:
curl http://YOUR_IP:8790/browse/rows
```

Should return JSON with movie/TV rows.
