# Streamflix Provider Port — Coverage

Ported from [streamflix-reborn/streamflix](https://github.com/streamflix-reborn/streamflix) (July 2026).

## Architecture

| Layer | Path | Count |
|-------|------|-------|
| VOD/anime providers | `tizenflix-api/src/streamflix/providers/` | 55 |
| IPTV providers | `tizenflix-api/src/streamflix/iptv/` | 19 |
| Extractors | `tizenflix-api/src/streamflix/extractors/` | 104 |
| TMDB-native | `tizenflix-api/src/streamflix/tmdb-native/` | 16 |

## API

```http
GET /providers/streamflix          # VOD provider list + health
GET /live/providers                # IPTV provider list
GET /live/:providerId/channels     # Channel grid (M3U / Vavoo / scrape)
GET /live/:providerId/play/:channelId  # PlayResponse for direct play
GET /play/movie/:tmdbId?backend=streamflix
```

## Tooling

```bash
cd tizenflix-api
STREAMFLIX_REF=/tmp/streamflix-ref node scripts/bulk-port-extractors.mjs
node scripts/regenerate-extractor-registry.mjs
node scripts/provider-coverage.mjs
npm run benchmark-streamflix
```

## Implementation tiers

- **Full custom**: sflix, ridomovies, superstream, streaming-community-*, frembed, m-stream, anikoto, anime-flv, hianime, wiflix
- **HTML factory (batch-providers.ts)**: 24 regional VOD sites
- **Search HTML factory (stub-providers.ts)**: 15 anime/VOD stubs + 4 new (anime-bum, otakufr, streaming-ita, un-jour-un-film)
- **IPTV M3U**: Pluto TV × 7, IPTV-Org, IPTV-Spain, MAGISTV
- **IPTV scrape**: CableVisionHD, TvLibrefutbol, TvporinternetHD, PelotaLibreTvHd
- **IPTV API**: Vavoo × 5 locales

## App

Live TV screen: sidebar → **Live TV** → pick provider → channel rows → play via existing player.
