# TV setup — getting Tizenflix on your Samsung TV

This guide explains **what the gate test is**, whether you need to publish to npm first, and the exact steps to see video on your TV.

---

## What is the “gate test”?

The **gate test** is not a separate tool or npm command. It is a **go/no-go checklist** you run on real TV hardware before investing in UI polish.

The current gate test lives at `tizenflix-app/app/gate/index.html`. The main app is `tizenflix-app/app/index.html`.

It:

1. Connects to `tizenflix-api` on your LAN
2. Calls `GET /play/movie/27205` (Inception)
3. Plays the proxied HLS stream in `<video>` + HLS.js
4. Shows a checklist you tick off on the TV

| Checklist item | What it proves |
|----------------|----------------|
| API health OK | TV can reach your PC over Wi‑Fi |
| `/play` returns streams | Resolver + proxy work end-to-end |
| Video plays with sound | HLS works on your Tizen version |
| HLS segments load | Proxy rewrite works (not just manifest) |
| Back key exits | Remote / TizenBrew integration OK |

**Pass** → build the Netflix-style UI on this foundation.  
**Fail** → fix networking or playback before adding animations.

The older two-panel test (Vidking iframe vs custom player) lives in [`lab/tests/gate-test.html`](../lab/tests/gate-test.html) for reference. The new app replaces Gate B with `tizenflix-api`.

---

## Do you need to publish to npm first?

**No — not for your first TV test.**

| Method | When to use | Publish required? |
|--------|-------------|-------------------|
| **LAN dev server** (recommended first) | Testing on your home network today | No |
| **npm publish** | Stable install via jsDelivr | Yes (`npm publish`) |
| **GitHub repo in TizenBrew** | After pushing; TizenBrew fetches the repo | Push to GitHub |

TizenBrew ultimately loads web assets from a URL. For development, that URL can be `http://192.168.x.x:3010/app/index.html` on your PC.

---

## Prerequisites

- Samsung TV, **Tizen 3.0+** (2017 or newer)
- [TizenBrew](https://github.com/reisxd/TizenBrew) installed on the TV ([Installer Desktop](https://github.com/reisxd/TizenBrewInstaller/releases) is easiest)
- PC and TV on the **same Wi‑Fi / LAN**
- Node.js 18+ on your PC

---

## Step-by-step: first TV test (no npm publish)

### 1. Install TizenBrew on the TV

Use [TizenBrew Installer Desktop](https://github.com/reisxd/TizenBrewInstaller/releases):

1. On TV: Apps → enter `12345` → enable **Developer mode** → set **Host PC IP** to your PC’s IP → reboot
2. On PC: run the installer → **Install TizenBrew**
3. After install: set Host PC IP to `127.0.0.1` and reboot TV (per TizenBrew docs)
4. Launch **TizenBrew** on the TV

### 2. Start tizenflix-api on your PC

```bash
cd tizenflix-api
npm install
cp .env.example .env    # add TMDB_API_KEY (optional for /play-only test)
```

Find your PC’s LAN IP (e.g. `192.168.1.10`), then:

```bash
PUBLIC_BASE=http://192.168.1.10:8790 npm run api
```

Verify from your PC:

```bash
curl http://192.168.1.10:8790/health
```

Allow port **8790** through your firewall if needed.

### 3. Start the app dev server on your PC

```bash
cd tizenflix-app
npm start
```

The terminal prints LAN URLs like:

```
http://192.168.1.10:3010/app/index.html
```

Verify in a desktop browser first, then note the URL for the TV.

### 4. Load the app on the TV via TizenBrew

TizenBrew has **no “paste a URL” option** — only **npm** and **GitHub** modules. The LAN URL goes inside root `package.json` as `websiteURL` (mods type).

**Option A — GitHub module (LAN dev, no npm)**

1. Ensure root `package.json` has your PC LAN IP in `websiteURL` (see repo root).
2. Commit, push, and create a **GitHub release** (TizenBrew reads `package.json` from the latest release tag).
3. On TV: TizenBrew → Module Manager → **Add GitHub module** → `DevA-rora/Tizenflix`
4. Launch **Tizenflix** from the module list — TizenBrew opens `websiteURL` (`http://192.168.x.x:3010/app/index.html`).

```bash
git add package.json tizenflix-app/ docs/ README.md
git commit -m "Add TizenBrew LAN dev module"
git push
gh release create v0.1.0 --title "v0.1.0" --notes "LAN dev module for TV gate test"
```

**Option B — npm publish (stable)**

```bash
cd tizenflix-app
npm publish --access public
```

On TV: TizenBrew → GREEN → type `@dev-arora/tizenflix` → launch.

> Update the `name` field in `package.json` if `@dev-arora` is not your npm scope.

### 5. Run the gate checklist on the TV

1. Open Tizenflix on the TV (main app at `/app/index.html`, or gate at `/app/gate/index.html`)
2. Set **API URL** to `http://192.168.1.10:8790` (your PC IP) — gate test only
3. Press **Save & test** → should show API OK — gate test only
4. Press **Play movie** or **S1E1** — gate test
5. Record results in [`tizenflix-app/RESULTS.md`](../tizenflix-app/RESULTS.md)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API health fails on TV | Use LAN IP, not `localhost`. Same Wi‑Fi. Check firewall on port 8790. |
| `/play` 502 | Upstream provider down — try `?server=Oxygen` in API or check `tizenflix-api` logs |
| Video spinner forever | `PUBLIC_BASE` must be LAN IP so proxied m3u8 segment URLs are reachable from TV |
| HLS.js error | Older Tizen may need native HLS path — check player log on screen |
| TizenBrew won’t load LAN URL | Some firmware blocks non-HTTPS; try GitHub Pages or npm jsDelivr |
| Back key doesn’t exit | Expected — TizenBrew handles exit; checklist item confirms key is received |

### Tizen CSS/JS compatibility (black screen, invisible text)

If you see a **mostly black screen** with only native input/buttons visible:

| Cause | Fix (v0.1.1+) |
|-------|----------------|
| CSS `var(--*)` custom properties fail | App now uses literal hex colors — see [`tizenflix-app/TIZEN_COMPAT.md`](../tizenflix-app/TIZEN_COMPAT.md) |
| `<script type="module">` never runs | App uses bundled `app/dist/app.bundle.js` (run `npm run build`) |
| Empty video bar at bottom | Video is hidden until Play starts |
| No focus ring on D-pad | Look for **"Focused: …"** hint top-right + white/red border on focused control |

After pulling v0.1.1, on your PC:

```bash
cd tizenflix-app && npm install && npm run build && npm start
```

On TV: remove and re-add the `DevA-rora/Tizenflix` GitHub module so TizenBrew picks up release **v0.1.1**.

### Playback diagnostics (black video box)

Use the three buttons on the gate screen:

| Button | What it tests |
|--------|----------------|
| **Test LAN MP4** | `GET /test/sample.mp4` — plain MP4 from your API, no HLS |
| **Test API HLS** | Full `/play/movie/27205` resolve + HLS playback |
| **Play movie** | Same as Test API HLS |

Read the **red debug bar at the bottom** of the screen for player path and errors.

| Result | Meaning |
|--------|---------|
| MP4 plays, HLS black | HLS player path issue (native vs HLS.js) — check overlay for `HLS.js FATAL` |
| MP4 also black | TV `<video>` or LAN issue — check `video error` in overlay |
| Both work | Gate passed — proceed to full UI |

**Tizen `video.play()` note:** Samsung TVs often return `undefined` from `play()`, not a Promise. The app uses `safePlay()` (no `.catch` on undefined) and waits for `canplay` before calling `play()`. If video loads but stays paused, use **Play / Pause** on the playback bar or the remote **Play** key.

Generate the sample MP4 on your PC if missing:

```bash
cd tizenflix-api && npm run sample-mp4
```

---

## What comes after the gate test?

1. Scaffold home screen (browse rows from API)
2. Title detail + episode picker
3. Spatial focus + row animations
4. Appwrite (auth, progress, watchlist)

See [gate-findings.md](./gate-findings.md) for playback architecture and [tizenbrew-app-research.md](./tizenbrew-app-research.md) for the full roadmap.
