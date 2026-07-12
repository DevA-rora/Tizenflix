# TMDB-Native Benchmark v4

Generated: 2026-07-12T11:24:46.395Z
Sources: 12

## Preflight (embed host reachability)

| Source | Reachable | Status | ms |
|--------|-----------|--------|-----|
| VixSrc | true | 200 | 803 |
| Videasy | true | 404 | 633 |
| Moviesapi | false | - | 242 |
| 2Embed | true | 200 | 1066 |
| Vidsrc.net | true | 200 | 891 |
| VidLink | true | 200 | 619 |
| Vidsrc.Ru | true | 200 | 625 |
| Vidflix | true | 200 | 592 |
| Vidrock | true | 200 | 934 |
| Vidzee | true | 200 | 528 |
| PrimeSrc | true | 200 | 626 |
| Vidsrc.to | true | 200 | 1279 |

## Summary

- Vidking wins: 0
- TMDB-native wins: 8
- Ties: 2
- Unresolved: 0

## Matrix A — Per title

| Title | Vidking HLS | TMDB-native HLS | Winner | Best source |
|-------|-------------|-----------------|--------|-------------|
| Inception | 5 | 1 | tie | VixSrc |
| Off Campus S1E1 | 4 | 1 | tie | VixSrc |
| The Matrix | 0 | 1 | tmdb-native | VixSrc |
| Breaking Bad S1E1 | 0 | 1 | tmdb-native | VixSrc |
| Interstellar | 0 | 1 | tmdb-native | VixSrc |
| The Office S1E1 | 0 | 1 | tmdb-native | VixSrc |
| Pulp Fiction | 0 | 1 | tmdb-native | VixSrc |
| Stranger Things S1E1 | 0 | 1 | tmdb-native | VixSrc |
| The Dark Knight | 0 | 1 | tmdb-native | VixSrc |
| Game of Thrones S1E1 | 0 | 1 | tmdb-native | VixSrc |

## Matrix B — Source × Title (HLS count)

| Source | Inception | Off Campus S | The Matrix | Breaking Bad | Interstellar | The Office S | Pulp Fiction | Stranger Thi | The Dark Kni | Game of Thro | Wins | Avg ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VixSrc | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 8 | 1094 |
| Videasy | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2298 |
| Moviesapi | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 383 |
| 2Embed | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12003 |
| Vidsrc.net | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12003 |
| VidLink | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5020 |
| Vidsrc.Ru | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12003 |
| Vidflix | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12003 |
| Vidrock | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2091 |
| Vidzee | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2818 |
| PrimeSrc | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12002 |
| Vidsrc.to | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12002 |

## Matrix C — Inception per-source detail

| Source | OK | HLS | ms | Layer | Error |
|--------|----|-----|-----|-------|-------|
| VixSrc | true | 1 | 2079 | - |  |
| Videasy | false | 0 | 3671 | api_hop | Neon (Videasy): HTTP 404 for https://api.videasy.n |
| Moviesapi | false | 0 | 1095 | api_hop | Moviesapi: fetch failed |
| 2Embed | false | 0 | 12002 | network | network: source timeout |
| Vidsrc.net | false | 0 | 12002 | network | network: source timeout |
| VidLink | false | 0 | 5701 | api_hop | https://vidlink.pro: VidLink: no playlist in API r |
| Vidsrc.Ru | false | 0 | 12001 | network | network: source timeout |
| Vidflix | false | 0 | 12001 | network | network: source timeout |
| Vidrock | false | 0 | 1524 | api_hop | api_hop: no server entries |
| Vidzee | false | 0 | 3597 | extract | Nflix (Vidzee): Vidzee: master key failed; Duke (V |
| PrimeSrc | false | 0 | 12014 | network | network: source timeout |
| Vidsrc.to | false | 0 | 12002 | network | network: source timeout |