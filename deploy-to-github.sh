#!/bin/bash
# Deploy updated Tizenflix to GitHub with new release

set -e

echo "=== Tizenflix GitHub Release Script ==="
echo ""
echo "This will:"
echo "1. Stage all changes (IP updates, HLS fixes, new docs)"
echo "2. Commit them"
echo "3. Push to GitHub"
echo "4. Create release v0.1.3"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Check current status
echo ""
echo "=== Current Git Status ==="
git status

echo ""
read -p "Stage these changes? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Stage changes
echo ""
echo "=== Staging Changes ==="
git add package.json
git add tizenflix-api/.env
git add tizenflix-api/src/proxy/request-deduplication.ts
git add tizenflix-api/src/server/register-routes.ts
git add tizenflix-api/scripts/fix-public-base.mjs
git add tizenflix-api/scripts/detect-ip.sh
git add docs/gate-findings.md
git add tizenflix-app/app/gate/index.html
git add tizenflix-app/README.md
git add HLS_MANIFEST_ERROR_FIX.md
git add NETWORK_SETUP_STATUS.md
git add QUICK_START_CHECKLIST.md
git add TIZENBREW_REINSTALL_GUIDE.md
git add UPDATE_TIZENBREW_APP.md

echo "✓ Changes staged"

# Commit
echo ""
echo "=== Committing ==="
git commit -m "fix: Update IP to 192.168.86.49 + HLS manifest error fixes

- Fixed PUBLIC_BASE in API to use actual IP (was localhost)
- Fixed package.json websiteURL to use actual IP
- Fixed Response cloning bug in request deduplication
- Fixed missing profile=tizen parameter on inline manifest URLs
- Added IP detection and configuration scripts
- Confirmed working on iPad/browser
- Ready for TV deployment via TizenBrew"

echo "✓ Changes committed"

# Push
echo ""
echo "=== Pushing to GitHub ==="
git push origin main

echo "✓ Pushed to GitHub"

# Create release
echo ""
echo "=== Creating GitHub Release v0.1.3 ==="

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found!"
    echo ""
    echo "Install it:"
    echo "  sudo apt install gh"
    echo "  # or download from: https://github.com/cli/cli/releases"
    echo ""
    echo "After installing, run:"
    echo "  gh auth login"
    echo "  gh release create v0.1.3 --title 'v0.1.3 - IP Update + HLS Fixes' --notes 'See CHANGELOG.md'"
    exit 1
fi

gh release create v0.1.3 \
  --title "v0.1.3 - IP Update + HLS Fixes" \
  --notes "## Changes

### Network Configuration
- Updated IP addresses to 192.168.86.49
- Fixed PUBLIC_BASE in API (was localhost, now actual IP)
- Fixed package.json websiteURL for TizenBrew

### HLS Playback Fixes
- **Fixed Response cloning bug** in request deduplication that caused 'Body has already been consumed' errors
- **Fixed missing profile=tizen parameter** on inline manifest URLs (TV now gets optimized 2-rung manifests)
- Enhanced manifest pre-warming system

### New Tools
- IP auto-detection script (\`scripts/fix-public-base.mjs\`)
- Comprehensive troubleshooting guides

### Testing Status
✅ Confirmed working on iPad/browser  
⏳ Ready for TV deployment via TizenBrew

See \`HLS_MANIFEST_ERROR_FIX.md\` for technical details."

echo ""
echo "✅ Release v0.1.3 created successfully!"
echo ""
echo "=== Next Steps on TV ==="
echo "1. Open TizenBrew on your Samsung TV"
echo "2. Go to Module Manager → Remove Tizenflix"
echo "3. Add GitHub module → YOUR_USERNAME/Tizenflix"
echo "4. Launch Tizenflix"
echo ""
echo "It should now load from: http://192.168.86.49:3010/app/index.html"
echo ""
echo "Done! 🎉"
