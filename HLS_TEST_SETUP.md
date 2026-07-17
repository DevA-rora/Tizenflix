# HLS.js Test Setup - Quick Start

## What Changed

The Tizenflix homebrew app now loads a dedicated HLS.js test page instead of the full application. This helps diagnose whether playback issues are caused by:
1. HLS.js not working on the TV
2. Stream URLs being invalid/blocked
3. Codec/format incompatibility

## Deploy the Test

```bash
cd tizenflix-app
npm run build  # This still builds the main app bundles, but they won't be used
# Deploy to TV using TizenBrew as usual
```

The test page (`app/hls-test.html`) doesn't need building - it's standalone HTML.

## What You'll See on TV

📺 **A test interface with:**
- 5 pre-configured test streams (4 HLS, 1 MP4)
- A video player that auto-loads the first stream
- Real-time debug log showing everything that happens
- Status indicator (loading/ready/error)

🎮 **TV Remote works:**
- Play/Pause button
- Fast Forward/Rewind (±10s)
- D-pad to select different streams

## Expected Behavior

### If HLS.js Works ✅
- First stream auto-loads within 1 second
- Status shows "✅ HLS manifest loaded - Ready to play"
- Video starts playing automatically
- You can switch between different test streams
- **This means**: The problem is with your API's stream URLs, not HLS.js

### If HLS.js Doesn't Work ❌
- Log shows "HLS.js supported: NO"
- May fall back to native HLS (depends on TV)
- Test streams might still play if native HLS works
- **This means**: Need to find providers that give direct MP4/native HLS URLs

### If Nothing Works 🚫
- Errors in the debug log
- Video element shows error codes
- **This means**: Deeper compatibility issue with the TV

## Reading the Debug Log

The on-screen log shows:
```
[10:23:45] === HLS Support Detection ===
[10:23:45] Native HLS support: NO
[10:23:45] HLS.js available: YES
[10:23:45] HLS.js supported: YES
[10:23:45] HLS.js version: 1.x.x
[10:23:46] === Loading Stream ===
[10:23:46] Title: Big Buck Bunny (HLS)
[10:23:46] Using HLS.js for playback
[10:23:47] HLS: Media attached
[10:23:47] HLS: Manifest parsed, 4 quality levels
[10:23:47] ✅ HLS manifest loaded - Ready to play
[10:23:47] Video: Can play
[10:23:47] Video: Playing
```

Look for:
- ✅ "HLS.js supported: YES" = Good!
- ❌ "HLS Error" or "Video error" = Problem detected
- ⏳ "Buffering..." then playing = Network is slow but working

## Switch Back to Full App

When done testing:

1. Edit `tizenflix-app/package.json`
2. Change:
   ```json
   "appPath": "app/hls-test.html"
   ```
   Back to:
   ```json
   "appPath": "app/index.html"
   ```
3. Rebuild and redeploy

## Files Created

- `tizenflix-app/app/hls-test.html` - The test page
- `tizenflix-app/HLS_TEST_MODE.md` - Detailed documentation
- This file - Quick reference

## Troubleshooting

**Q: Page is blank**
A: Check if `lib/hls.min.js` exists in the app folder

**Q: Can't see the log**
A: Use the D-pad to scroll down to the Debug Log section

**Q: Remote not working**
A: Check that the app has the media key permissions (already configured)

**Q: Video plays but is blank/frozen**
A: Codec issue - check TV specs for supported formats

## Next Steps

After testing, you'll know:
1. ✅ If HLS.js works → Focus on fixing stream URL generation
2. ❌ If HLS.js fails → Look for providers with direct MP4 links
3. 📊 If only some streams work → May need to proxy/filter by codec

Good luck! The test should give you clear answers about where the issue is.
