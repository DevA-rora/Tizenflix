# TV test results

Fill this in after running the gate checklist on your Samsung TV.

## Device

| Field | Value |
|-------|-------|
| TV model | |
| Tizen version | |
| Year | |
| Test date | |

## Desktop (browser) — smoke test 2026-07-12

| Test | Pass | Notes |
|------|------|-------|
| `npm start` serves app | ✓ | Bundle rebuilt (`npm run build`) |
| API health from browser | ✓ | `GET /health` OK |
| Play movie (27205) | ✓ | API recommends playable source (no `?server=` hardcode) |
| Off Campus S1E1 (273240/1/1) | | Retest on TV |
| Off Campus S1E2 (273240/1/2) | ✓ | API returns 2 quality rungs; Oxygen recommended |

## Samsung TV (TizenBrew) — universal playback retest

Run on TV after `npm run build` and restarting app + API servers on your PC.

| Test | Pass | Notes |
|------|------|-------|
| TizenBrew loads the app | | LAN / npm / GitHub method used: |
| API health from TV | | API URL used: |
| **Test LAN MP4** | | |
| **Test LAN HLS** | | |
| **Play movie** — Inception | | Should auto-pick best provider |
| **Off Campus S1E1** | | |
| **Off Campus S1E2** | | Watch for `Recovering from bufferStalledError` (should self-heal) |
| **Off Campus S1E3** | | |
| E1 → Stop → E2 switch | | Clean teardown between episodes |
| HLS segments (no endless buffer) | | `playing t=N s` in debug overlay |
| **Play / Pause** | | |
| Back key | | |

### Debug overlay — what to look for

| Log line | Meaning |
|----------|---------|
| `rs=2(current) ns=2(loading)` | Source loading normally |
| `rs=0(nothing) ns=3(no_source)` before canplay | Too early to play (fixed in latest build) |
| `Native HLS stall — falling back to HLS.js` | Native path failed; retrying with HLS.js |
| `Loaded — press Play on remote or tap Resume` | Autoplay blocked; use Play control |
| `Recovering from bufferStalledError` | Non-fatal stall — player nudges and restarts load |
| `Recovering from fragLoadTimeOut` | Fragment timeout — player restarts HLS load |
| `Quality: WxH` | Current HLS level (ABR may downshift to lower rung) |

## Decision

- [ ] **Go** — streaming works on TV → build full UI
- [ ] **Blocked** — note blockers below

### Blockers / follow-ups
