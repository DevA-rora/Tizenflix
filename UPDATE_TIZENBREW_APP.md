# Update TizenBrew App with New IP

## Problem
Your `package.json` now has the correct IP (`192.168.86.49`), but the TV is still trying to load from the old IP (`192.168.86.11`).

## Solution: Create New GitHub Release

TizenBrew reads `package.json` from your **latest GitHub release tag**. You need to create a new release with the updated IP.

### Quick Steps

#### 1. Commit the IP Changes
```bash
cd ~/Code/01_building/Tizenflix

# Check what changed
git status

# Add the updated files
git add package.json tizenflix-api/.env

# Commit
git commit -m "fix: Update IP addresses to 192.168.86.49"

# Push to GitHub
git push origin main
```

#### 2. Create a New GitHub Release

**Option A: Using GitHub CLI** (recommended):
```bash
# Install gh if needed:
# sudo apt install gh
# gh auth login

# Create new release
gh release create v0.1.3 \
  --title "v0.1.3 - IP Update" \
  --notes "Updated network configuration for IP 192.168.86.49

- Fixed API PUBLIC_BASE
- Fixed app websiteURL
- Fixed Response cloning bug
- Fixed profile=tizen parameter passing"
```

**Option B: Using GitHub Web UI**:
1. Go to: https://github.com/YOUR_USERNAME/Tizenflix/releases
2. Click **"Draft a new release"**
3. Tag version: `v0.1.3`
4. Release title: `v0.1.3 - IP Update`
5. Description:
   ```
   Updated network configuration for IP 192.168.86.49
   
   - Fixed API PUBLIC_BASE
   - Fixed app websiteURL  
   - Fixed Response cloning bug
   - Fixed profile=tizen parameter passing
   ```
6. Click **"Publish release"**

#### 3. Update App on TV

##### Option A: Remove & Reinstall (Clean)
1. Open **TizenBrew** on TV
2. Go to **Module Manager** or **Installed Apps**
3. Find **Tizenflix**
4. Remove/Uninstall it
5. Go to **Add GitHub module**
6. Enter: `YOUR_USERNAME/Tizenflix` (or whatever your repo path is)
7. Install
8. Launch Tizenflix

##### Option B: Force Update (If TizenBrew Supports It)
1. Open **TizenBrew** on TV
2. Go to **Module Manager**
3. Find **Tizenflix**
4. Look for **"Update"** or **"Refresh"** option
5. If available, click it to pull latest release

### Verify It Worked

#### Check the URL
When you open Tizenflix on TV, it should load:
```
http://192.168.86.49:3010/app/index.html
```

NOT:
```
http://192.168.86.11:3010/app/index.html  ❌
```

#### Check Your PC Terminals

**Terminal 1 (tizenflix-app - port 3010)**:
When TV loads the app, you should see:
```
GET /app/index.html 200
GET /dist/app.bundle.js 200
GET /css/base.css 200
```

**Terminal 2 (tizenflix-api - port 8790)**:
When TV tries to browse/play, you should see:
```
GET /browse/rows
GET /play/movie/27205
[prewarm] Yoru 1080p: cached as tizenflix-inline-manifest:...
```

#### Test Playback
1. Browse for a movie/show
2. Try playing
3. Should work! 🎉

## Alternative: Direct Browser Access (Bypass TizenBrew)

While waiting for GitHub release/reinstall, test directly:

1. Open **Samsung Internet Browser** on TV
2. Navigate to: `http://192.168.86.49:3010/app/index.html`
3. This bypasses TizenBrew entirely
4. If playback works here, you know the issue was just TizenBrew's cached URL

## Troubleshooting

### "gh: command not found"
Install GitHub CLI:
```bash
# Ubuntu/Debian
sudo apt install gh

# Or download from: https://github.com/cli/cli/releases

# Login
gh auth login
```

### "git push rejected"
Make sure you're pushing to the right remote:
```bash
git remote -v
# Should show your GitHub repo

# If not set up:
git remote add origin https://github.com/YOUR_USERNAME/Tizenflix.git
git push -u origin main
```

### "TizenBrew can't find the module"
- Make sure the release is **public** (not draft)
- Wait a few minutes for GitHub to process
- Check the release has `package.json` visible
- Try using the full GitHub path in TizenBrew

### "App still loads old IP"
- TizenBrew is definitely caching
- Try removing app from TV completely
- Restart TizenBrew
- Reinstall from fresh GitHub release
- Or use Samsung browser to bypass TizenBrew

## Why This Happens

TizenBrew stores module configurations including the `websiteURL` from `package.json`. When you update `package.json` locally, TizenBrew on the TV doesn't know about it until:

1. You push to GitHub
2. You create a new release
3. TizenBrew fetches the new release
4. TizenBrew re-reads `package.json`

## Current Status

✅ **iPad works**: Confirms API fixes are working  
✅ **package.json updated**: Has correct IP `192.168.86.49`  
✅ **API configured**: `.env` has correct PUBLIC_BASE  
⏳ **TV needs update**: Need to reinstall TizenBrew app with new release  

Once you create the GitHub release and reinstall on TV, everything should work!

## Quick Command Reference

```bash
# 1. Commit and push
git add -A
git commit -m "fix: Update IP to 192.168.86.49"
git push origin main

# 2. Create release
gh release create v0.1.3 --title "v0.1.3" --notes "IP update"

# 3. On TV: Remove old Tizenflix, reinstall from GitHub

# 4. Test!
```
