# HLS Test Mode

This document explains how to switch between the full Tizenflix app and the HLS.js test page.

## Current Configuration

The homebrew app is currently configured to load the **HLS.js test page** instead of the full application.

## What the Test Page Does

The `app/hls-test.html` page provides:

✅ **Multiple test streams** - Includes both HLS (.m3u8) and direct MP4 streams
✅ **HLS.js integration** - Tests if HLS.js can load and play HLS streams on the TV
✅ **Native HLS fallback** - Tests native HLS support if HLS.js fails
✅ **Detailed logging** - Shows all events, errors, and state changes
✅ **TV remote support** - Play/Pause, FF/Rewind keys work
✅ **Visual feedback** - Clear status indicators for what's happening

## Test Streams Included

1. **Big Buck Bunny (HLS)** - Standard test stream
2. **Sintel Trailer (HLS)** - Akamai CDN stream
3. **Apple Advanced Stream (HLS)** - Apple's reference stream
4. **Tears of Steel (HLS)** - Unified Streaming example
5. **Big Buck Bunny (MP4)** - Direct MP4 for baseline test

## How to Use

1. **Build and deploy** the app as usual:
   ```bash
   cd tizenflix-app
   npm run build
   # Then use TizenBrew to deploy to TV
   ```

2. **On the TV**, the test page will:
   - Auto-detect HLS.js and native HLS support
   - Auto-load the first test stream
   - Show all debug logs on screen
   - Respond to TV remote control

3. **Watch the logs** to see:
   - If HLS.js is available and working
   - If streams load successfully
   - Any errors that occur
   - Video element events

## What This Tests

🔍 **Stream Fetching**: If the first stream plays, stream fetching from your API works
🔍 **HLS.js Support**: If HLS streams play, HLS.js works on the TV
🔍 **Native Support**: Fallback detection if HLS.js doesn't work
🔍 **Decoding**: If video actually plays, codec support is good
🔍 **Controls**: If remote works, event handling is correct

## Switching Between Modes

### To Run Test Mode (Current)
In `package.json`, set:
```json
"appPath": "app/hls-test.html"
```

### To Run Full App
In `package.json`, set:
```json
"appPath": "app/index.html"
```

Then rebuild:
```bash
npm run build
```

## Interpreting Results

### ✅ Success Case
- Status shows "Ready to play" or "Playing"
- Video actually plays on screen
- No fatal errors in debug log
- **Conclusion**: HLS.js works, issue is likely with stream URLs from your API

### ❌ HLS.js Not Supported
- Log shows "HLS.js supported: NO"
- May fall back to native HLS
- **Conclusion**: TV doesn't support HLS.js, need alternative approach

### ❌ Streams Won't Load
- Errors like "MANIFEST_LOAD_ERROR" or "NETWORK_ERROR"
- **Conclusion**: Network/CORS issue, or stream URLs are invalid

### ❌ Video Element Error
- "MEDIA_ERR_DECODE" or similar
- **Conclusion**: Codec or format issue with the streams

## Next Steps Based on Results

If test streams work but your API streams don't:
- Check the actual stream URLs your API returns
- Verify they're not geoblocked or require special headers
- Test the URLs in a browser first

If HLS.js doesn't work at all:
- Consider using direct MP4 URLs instead
- Look for providers that give direct video URLs
- May need to proxy/transcode streams

If nothing plays:
- Check Tizen WebView version
- May need different video formats
- Could be DRM or codec restrictions

## Files Modified

- `tizenflix-app/package.json` - Changed `appPath` to point to test page
- `tizenflix-app/app/hls-test.html` - New standalone test page (no build needed)

The test page is self-contained and doesn't need the app bundle - it only uses HLS.js from the lib folder.
