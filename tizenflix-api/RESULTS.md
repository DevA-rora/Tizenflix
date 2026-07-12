# Test results

| Test | Status | Notes |
|------|--------|-------|
| Movie 27205 resolve | PASS | Hydrogen 1080p/720p/480p/4K m3u8 |
| TV 1396 S1E1 resolve | PASS | Breaking Bad via Hydrogen |
| Server switch Oxygen | PASS | `--server Oxygen` |
| Download movie manifest | PASS | `fixtures/inception-480p.m3u8` (1111 segments) |
| Parallel HLS download (480p full) | PASS | ~8 min, 730 MiB, 02:29:29 verified |
| Parallel HLS proof (120s clip) | PASS | ~14s, 12 MiB, 854×480 |
| Download TV manifest | PASS | `fixtures/breaking-bad-s01e01.m3u8` (438 segments) |
| Play API /health | PASS | `http://localhost:8790/health` |
| Play API /play/movie | PASS | Proxied source URLs |
| Network capture | PASS | `fixtures/capture-*.json` |
| Unit/integration tests | PASS | `npm test` (7/7) |

Run date: 2026-07-11
