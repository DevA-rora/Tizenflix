# Upstream Streamflix sync

When playback breaks for a title, check whether [streamflix-reborn](https://github.com/streamflix-reborn/streamflix) already fixed the provider.

## Quick sync

```bash
cd tizenflix-api
npm run sync-streamflix
```

This clones/pulls upstream into `$STREAMFLIX_REF` (default `/tmp/streamflix-ref`) and runs the Kotlin port registry diff helper.

## Manual port workflow

1. Find the matching Kotlin file under `app/src/main/java/com/streamflixreborn/streamflix/providers/` or `extractors/`
2. Port the change to the TypeScript twin under `tizenflix-api/src/streamflix/providers/` or `extractors/`
3. Run `npm run benchmark-streamflix` from home LAN (live network)
4. Toggle provider off/on via Settings → Manage providers if needed

## Scaffold new providers

```bash
STREAMFLIX_REF=/tmp/streamflix-ref node scripts/port-from-kotlin.mjs
```

Generates skeleton TS from upstream Kotlin registry. Fill in scrape/extract logic by hand from the Kotlin source.

## Do not duplicate maintenance

- **Primary CDN**: Vidking (WingsDatabase) via `backend=auto` step 1 — update via `npm run capture` when player crypto changes
- **Streamflix scrapers**: sync upstream when step 2 breaks — see this doc
- **TMDB-native**: auto step 3 / quality upgrade — fix embed extractors when VixSrc/embeds fail broadly
