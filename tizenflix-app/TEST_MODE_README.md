# 🧪 HLS Test Mode - Complete Guide

The Tizenflix app is now configured to run a diagnostic HLS test page instead of the full application.

## Quick Commands

```bash
# Switch to test mode (already done)
npm run test-mode

# Switch back to production mode
npm run prod-mode

# Toggle between modes
npm run toggle-mode

# Build and deploy (works in either mode)
npm run build
```

## What's Happening

The `package.json` now has:
```json
"appPath": "app/hls-test.html"
```

This means when you deploy the app to your TV, it loads the test page instead of the main app.

## The Test Page

**Location**: `app/hls-test.html`

**Features**:
- 🎬 5 test streams (4 HLS, 1 MP4)
- 📊 Real-time debug log on screen
- 🎮 Full TV remote support
- ✅ Auto-detects HLS.js and native HLS support
- 📺 Auto-loads first stream for immediate testing

**Test Streams**:
1. Big Buck Bunny (HLS) - Standard test
2. Sintel Trailer (HLS) - Akamai CDN
3. Apple Advanced (HLS) - Apple reference
4. Tears of Steel (HLS) - Unified Streaming
5. Big Buck Bunny (MP4) - Direct baseline

## Deploy to TV

```bash
# 1. Build (even though test page doesn't need it)
npm run build

# 2. Deploy using TizenBrew
# (Use your normal deployment method)
```

The app will now show the HLS test page on your TV.

## What to Look For

### ✅ Success (HLS.js works)
```
[Time] HLS.js supported: YES
[Time] HLS.js version: 1.x.x
[Time] HLS: Manifest parsed, 4 quality levels
[Time] ✅ HLS manifest loaded - Ready to play
[Time] Video: Playing
```
**Conclusion**: HLS.js works! Your issue is with the stream URLs from your API.

### ⚠️ Partial Success (Native HLS only)
```
[Time] HLS.js supported: NO
[Time] Native HLS support: YES
[Time] Using native HLS playback
```
**Conclusion**: Need providers that give native HLS or direct MP4 URLs.

### ❌ Failure (Nothing works)
```
[Time] HLS.js supported: NO
[Time] Native HLS support: NO
[Time] Video error: MEDIA_ERR_SRC_NOT_SUPPORTED
```
**Conclusion**: TV has limited codec support or deeper compatibility issues.

### 🌐 Network Issues
```
[Time] HLS Error: MANIFEST_LOAD_ERROR
[Time] HLS Error: NETWORK_ERROR
```
**Conclusion**: CORS, network, or URL accessibility issues.

## Using the Test Page on TV

**D-pad Navigation**:
- Up/Down/Left/Right - Navigate between streams
- Enter - Select a stream to play

**Media Keys**:
- Play/Pause button - Toggle playback
- Fast Forward - Skip +10 seconds
- Rewind - Skip -10 seconds
- Back - (logged, but doesn't exit)

**What Happens**:
1. Page loads and detects capabilities
2. First stream auto-loads after 1 second
3. Video should start playing automatically
4. All events logged to debug section
5. You can try different streams

## Switch Back to Full App

When you're done testing:

```bash
# Easy way
npm run prod-mode

# Then rebuild
npm run build

# Redeploy to TV
```

Or manually edit `package.json`:
```json
"appPath": "app/index.html"
```

## Interpreting Results

### Scenario 1: Test streams work, your API streams don't
**Problem**: Stream URLs from your API are invalid/blocked
**Solution**: 
- Verify API stream URLs in browser first
- Check for geo-blocking
- Verify providers are working
- Check CORS headers

### Scenario 2: HLS.js works but streams buffer/stutter
**Problem**: Network speed or stream quality
**Solution**:
- Use lower quality streams
- Check TV's network connection
- May need to proxy/transcode

### Scenario 3: HLS.js not supported
**Problem**: TV WebView too old or restricted
**Solution**:
- Find providers with direct MP4 URLs
- Use native HLS sources
- Consider server-side transcoding

### Scenario 4: Nothing plays at all
**Problem**: Codec/format compatibility
**Solution**:
- Check TV's supported codecs
- May need H.264 baseline profile
- Consider different video container formats

## Files Created

```
tizenflix-app/
├── app/
│   └── hls-test.html              # Test page (standalone)
├── scripts/
│   └── toggle-test-mode.mjs       # Mode switcher script
├── HLS_TEST_MODE.md               # Detailed documentation
├── TEST_MODE_README.md            # This file
└── package.json                   # Modified appPath
```

## Technical Details

The test page:
- Uses HLS.js from `lib/hls.min.js` (already there)
- No build step needed (pure HTML/JS)
- Self-contained, no dependencies on app bundle
- Works with Tizen remote key codes (415, 417, 412, 10009)
- Comprehensive logging of all events

## Next Steps

1. **Build and deploy** to TV: `npm run build`
2. **Watch the logs** on the TV screen
3. **Try different streams** using D-pad
4. **Note which streams work** (if any)
5. **Based on results**, decide next action:
   - If test streams work → Fix API stream URLs
   - If HLS.js fails → Find alternative providers
   - If nothing works → Check TV codec support

## Support

If you need to debug further:
- All video events are logged
- HLS.js debug mode is enabled
- Network errors are caught and displayed
- TV remote key codes are logged

The test page gives you complete visibility into what's working and what isn't.

---

**Current Mode**: TEST (app loads `hls-test.html`)

To switch back: `npm run prod-mode`
