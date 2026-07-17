# TizenBrew Reinstall Guide

## Problem
The app won't open on TV because TizenBrew has cached the old IP address (`192.168.86.11`). Your current IP is `192.168.86.49`.

## Solution: Reinstall the App with Updated IP

### Method 1: Reinstall via TizenBrew UI (Recommended)

#### Step 1: Remove Old App
1. Open **TizenBrew** on your Samsung TV
2. Navigate to **Tizenflix** app
3. Press and hold **Enter** (or press **Tools** button)
4. Select **"Remove"** or **"Uninstall"**
5. Confirm removal

#### Step 2: Install Updated App
1. Still in TizenBrew, go to **"Mods"** or **"Add App"** section
2. Look for local app installation option
3. Point it to your development machine
4. Or use the TizenBrew developer mode to add the app

### Method 2: Using TizenBrew Developer Tools

#### If TizenBrew has a CLI or developer interface:

```bash
# On your PC, package the app
cd ~/Code/01_building/Tizenflix
zip -r tizenflix-0.1.2.zip package.json tizenflix-app/app/dev-noop.js

# Transfer to TV via TizenBrew's installation mechanism
# (Exact method depends on TizenBrew version)
```

### Method 3: Direct Browser Test (Bypass TizenBrew)

While troubleshooting, you can test directly:

1. Open **Samsung Internet Browser** on TV (not TizenBrew)
2. Navigate to: `http://192.168.86.49:3010/app/index.html`
3. This should load the app directly
4. Test if playback works

If this works, the issue is definitely TizenBrew's cached configuration.

### Method 4: Clear TizenBrew Cache

1. Open TizenBrew on TV
2. Go to **Settings** or **Tools**
3. Look for:
   - "Clear Cache"
   - "Reset Configuration"
   - "Clear App Data"
4. Apply and restart TizenBrew
5. Try opening Tizenflix again

### Method 5: Check TizenBrew Configuration File

Some TizenBrew versions store app configs in a JSON file. You might be able to edit it:

1. Open TizenBrew file manager (if available)
2. Look for config files in:
   - `/opt/usr/home/contents/tizenbrew/apps/`
   - Or wherever TizenBrew stores app configs
3. Find the Tizenflix entry
4. Edit the URL from `192.168.86.11:3010` to `192.168.86.49:3010`
5. Restart TizenBrew

## Verification Steps

After reinstalling/updating:

### 1. Check App Loads
- Open Tizenflix from TizenBrew
- Should see the Tizenflix UI (not blank screen)

### 2. Check Network Requests
If you can access TV logs/dev tools:
- Look for requests to `http://192.168.86.49:8790` (correct)
- NOT `http://192.168.86.11:8790` (old, wrong)

### 3. Test Playback
- Browse to a movie
- Try playing
- Check if HLS.js loads successfully

## Debugging: What's Actually Happening?

### Check Your PC Terminals

**Terminal 1 (API - port 8790)**:
```
[PROXY] manifest 403  391ms moon.ironbubble.site
[PROXY] manifest 200  363ms moon.ironbubble.site
[prewarm] Yoru 1080p: cached as tizenflix-inline-manifest:...
```
Should see activity when TV tries to play

**Terminal 2 (App - port 3010)**:
```
GET /app/index.html 200
GET /dist/app.bundle.js 200
```
Should see requests when TV loads the app

### If You See NO Requests

This means the TV isn't reaching your PC at all:

**Check**:
1. Is TV on same WiFi network as PC?
2. Can TV ping `192.168.86.49`? (If TV has network tools)
3. Firewall on PC blocking connections?
   ```bash
   # On Linux, check firewall:
   sudo ufw status
   
   # Allow ports if needed:
   sudo ufw allow 3010/tcp
   sudo ufw allow 8790/tcp
   ```

### If App Loads But Can't Connect to API

This means the app is using the wrong API URL (old IP):

**Solution**: Clear app localStorage (if TV has dev tools):
```javascript
// On TV browser/app console:
localStorage.clear();
location.reload();
```

Or reinstall the app completely.

## Alternative: Static IP

To prevent this issue in the future, set a **static IP** for your PC:

### On Linux:
```bash
# Edit netplan config (Ubuntu/Debian)
sudo nano /etc/netplan/01-network-manager-all.yaml

# Or use NetworkManager GUI:
nm-connection-editor
```

Set your PC to always use `192.168.86.49` (or any fixed IP in your network range).

## TizenBrew Documentation

Check TizenBrew's official docs for app management:
- GitHub: https://github.com/retr0h/tizenbrew (or relevant TizenBrew fork)
- Look for sections on:
  - Installing custom apps
  - Updating app URLs
  - Developer mode
  - App cache management

## Last Resort: Fresh TizenBrew Install

If nothing works:
1. Completely uninstall TizenBrew from TV
2. Reinstall TizenBrew
3. Install Tizenflix with correct IP from the start

## Expected Behavior After Fix

✅ TizenBrew shows Tizenflix app  
✅ Clicking app opens UI at `192.168.86.49:3010`  
✅ App auto-connects to API at `192.168.86.49:8790`  
✅ Playback works (HLS.js loads manifests successfully)  

## Quick Test: TV Browser

**Fastest way to test if everything works**:

1. Don't use TizenBrew yet
2. Open Samsung browser on TV
3. Go to: `http://192.168.86.49:3010/app/index.html`
4. Try playing something

If this works perfectly, the only issue is TizenBrew's cached config, and you just need to reinstall the app in TizenBrew.

## Need Help?

If you're stuck, provide:
1. TizenBrew version
2. Samsung TV model
3. Error message (if any) when opening app
4. Whether TV browser test works
5. PC terminal output (any requests from TV?)

---

**TL;DR**: TizenBrew cached the old IP. Uninstall Tizenflix from TizenBrew, then reinstall it. The new `package.json` has the correct IP, so reinstalling should fix it.
