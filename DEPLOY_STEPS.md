# Deploy to GitHub - Manual Steps

## Option 1: Automated Script (Recommended)

Just run:
```bash
cd ~/Code/01_building/Tizenflix
./deploy-to-github.sh
```

The script will:
- Stage all changes
- Commit with descriptive message
- Push to GitHub
- Create release v0.1.3

## Option 2: Manual Steps

### Step 1: Stage Changes
```bash
cd ~/Code/01_building/Tizenflix

# Core configuration files
git add package.json
git add tizenflix-api/.env

# API fixes
git add tizenflix-api/src/proxy/request-deduplication.ts
git add tizenflix-api/src/server/register-routes.ts

# Helper scripts
git add tizenflix-api/scripts/fix-public-base.mjs
git add tizenflix-api/scripts/detect-ip.sh

# Documentation updates
git add docs/gate-findings.md
git add tizenflix-app/app/gate/index.html
git add tizenflix-app/README.md

# New documentation
git add HLS_MANIFEST_ERROR_FIX.md
git add NETWORK_SETUP_STATUS.md
git add QUICK_START_CHECKLIST.md
git add TIZENBREW_REINSTALL_GUIDE.md
git add UPDATE_TIZENBREW_APP.md
git add deploy-to-github.sh
git add DEPLOY_STEPS.md
```

### Step 2: Commit
```bash
git commit -m "fix: Update IP to 192.168.86.49 + HLS manifest error fixes

- Fixed PUBLIC_BASE in API to use actual IP (was localhost)
- Fixed package.json websiteURL to use actual IP
- Fixed Response cloning bug in request deduplication
- Fixed missing profile=tizen parameter on inline manifest URLs
- Added IP detection and configuration scripts
- Confirmed working on iPad/browser
- Ready for TV deployment via TizenBrew"
```

### Step 3: Push to GitHub
```bash
git push origin main
```

### Step 4: Create GitHub Release

**If you have GitHub CLI (`gh`)**:
```bash
gh release create v0.1.3 \
  --title "v0.1.3 - IP Update + HLS Fixes" \
  --notes "## Changes

### Network Configuration
- Updated IP addresses to 192.168.86.49
- Fixed PUBLIC_BASE in API (was localhost, now actual IP)
- Fixed package.json websiteURL for TizenBrew

### HLS Playback Fixes
- Fixed Response cloning bug in request deduplication
- Fixed missing profile=tizen parameter on inline manifest URLs
- Enhanced manifest pre-warming system

### New Tools
- IP auto-detection script
- Comprehensive troubleshooting guides

### Testing Status
✅ Confirmed working on iPad/browser
⏳ Ready for TV deployment via TizenBrew

See HLS_MANIFEST_ERROR_FIX.md for technical details."
```

**If you don't have `gh` - Use GitHub Web UI**:
1. Go to: https://github.com/YOUR_USERNAME/Tizenflix/releases
2. Click **"Draft a new release"**
3. **Tag version**: `v0.1.3`
4. **Release title**: `v0.1.3 - IP Update + HLS Fixes`
5. **Description**: (Copy from above)
6. Click **"Publish release"**

### Step 5: Install GitHub CLI (if needed)
```bash
# Ubuntu/Debian
sudo apt install gh

# After install
gh auth login
# Follow the prompts to authenticate
```

## After GitHub Release is Created

### On Your Samsung TV:

1. **Open TizenBrew**
2. **Go to Module Manager** (or wherever installed apps are listed)
3. **Find and Remove Tizenflix** (completely uninstall)
4. **Go to Add GitHub Module** (or similar option)
5. **Enter**: `YOUR_USERNAME/Tizenflix` (replace with your actual GitHub username)
6. **Install** the module
7. **Launch Tizenflix**

The TV should now load:
```
http://192.168.86.49:3010/app/index.html
```

### Verify It's Working

**Check your PC terminals**:

Terminal 1 (tizenflix-app):
```
GET /app/index.html 200
GET /dist/app.bundle.js 200
```

Terminal 2 (tizenflix-api):
```
GET /browse/rows
[prewarm] Yoru 1080p: cached as tizenflix-inline-manifest:...
```

**Try playing something** - should work! 🎉

## Troubleshooting

### "gh: command not found"
Install GitHub CLI as shown above, or use the GitHub web UI method.

### "Permission denied (publickey)"
Your SSH keys aren't set up. Either:
- Set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- Or use HTTPS instead: `git remote set-url origin https://github.com/YOUR_USERNAME/Tizenflix.git`

### "Nothing to commit"
Good! Your changes are already committed. Skip to Step 3 (push).

### "Already up to date" when pushing
Your GitHub is already current. Skip to Step 4 (create release).

### TizenBrew still shows old IP
- Make sure you **completely removed** the old app
- **Restart TizenBrew** (close and reopen)
- **Restart TV** if needed
- Reinstall from GitHub

### Release doesn't appear in TizenBrew
- Wait a few minutes for GitHub to process
- Make sure release is **published** (not draft)
- Check release has `package.json` visible
- Try refreshing module list in TizenBrew

## Quick Reference

```bash
# Full workflow in one go:
cd ~/Code/01_building/Tizenflix
./deploy-to-github.sh

# Or manual:
git add -A
git commit -m "fix: IP update + HLS fixes"
git push origin main
gh release create v0.1.3 --title "v0.1.3" --notes "IP update + HLS fixes"

# On TV: Remove Tizenflix, reinstall from GitHub
```

## What Gets Updated

When TizenBrew installs from GitHub, it reads `package.json` which now has:
```json
{
  "websiteURL": "http://192.168.86.49:3010/app/index.html"
}
```

TizenBrew will then load the app from this URL, and the app will auto-detect the API at:
```
http://192.168.86.49:8790
```

Both servers must be running on your PC for the TV to work!
