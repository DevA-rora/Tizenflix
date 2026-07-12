# TV test results

Fill this in after running the gate checklist on your Samsung TV.

## Device

| Field | Value |
|-------|-------|
| TV model | |
| Tizen version | |
| Year | |
| Test date | |

## Desktop (browser)

| Test | Pass | Notes |
|------|------|-------|
| `npm start` serves app | | `http://localhost:3010/app/index.html` |
| API health from browser | | `PUBLIC_BASE` LAN URL |
| Play movie (27205) | | |

## Samsung TV (TizenBrew)

| Test | Pass | Notes |
|------|------|-------|
| TizenBrew loads the app | | LAN / npm / GitHub method used: |
| API health from TV | | API URL used: |
| Play movie — picture + sound | | |
| HLS segments (no endless buffer) | | |
| Back key | | |

## Decision

- [ ] **Go** — streaming works on TV → build full UI
- [ ] **Blocked** — note blockers below

### Blockers / follow-ups
