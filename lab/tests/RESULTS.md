# TV test results

Fill this in after running tests on your Samsung TV.

## Device

| Field | Value |
|-------|-------|
| TV model | |
| Tizen version | |
| Year | |
| Test date | |

## Desktop (Chrome)

| Test | Pass | Notes |
|------|------|-------|
| `docker compose up -d` health OK | | `curl http://localhost:8787/api/health` |
| stream-fetch returns mp4/m3u8 | | TMDB ID used: |
| custom-player plays video | | |
| custom-player subtitles | | OpenSubtitles proxy running? |
| vidking-iframe plays | | |
| vidking postMessage events | | |

## Samsung TV (TizenBrew)

| Test | Pass | Notes |
|------|------|-------|
| Gate A — Vidking iframe plays | | |
| Gate A — postMessage in log | | |
| Gate B — custom player plays | | API host used: |
| Back key exits cleanly | | |

## Decision

- [ ] **V2 path** — custom player works on TV → build own player + subtitle UI
- [ ] **V1 path** — only Vidking iframe works → ship iframe, defer custom player
- [ ] **Blocked** — neither works → note blockers below

### Blockers / follow-ups


