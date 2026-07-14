# Streamflix-first playback (July 2026)

> Supersedes the TMDB-native-primary model in [streamflix-cutover.md](./streamflix-cutover.md).

## Default resolve (`backend=streamflix` / `backend=auto`)

| Step | Engine | When |
|------|--------|------|
| 1 | Streamflix scrapers (anime: parallel race, then single-provider + capped scan @ 15s) | Always |
| 2 | TMDB-native | **Manual only** (`backend=tmdb-native` or quality upgrade) |
| 3 | Vidking CDN | **Manual only** (Settings → vidking or Server panel CDN pick) |

Client default backend: **streamflix**. Client resolve timeout: **90s**. CDN playback failure tries **next Streamflix provider** — not Vidking.

## Provider order (English)

1. `sflix`
2. `ridomovies`
3. `superstream`
4. `streaming-community-en`
5. `anymovie`

Anime uses: `hianime`, `anikoto`, `ani-world`, `anime-world`.

German catalog prepends: `film-palast`, `hd-filme`, `mega-kino`, `serien-stream`.

## API

```http
GET /play/movie/27205?backend=auto
GET /play/movie/27205?backend=streamflix&providerId=sflix
GET /play/movie/27205?backend=auto&preferredProviderId=ridomovies
GET /play/movie/27205?backend=streamflix&race=1
```

## Client recovery

- **Player → Server panel**: pick a Streamflix provider, stream source, or Vidking CDN fallback
- Preferred provider is saved in `localStorage` (`tizenflix.preferredProvider`) and passed as `preferredProviderId` on the next play

## Maintenance

When a provider breaks, sync from upstream — see [streamflix-upstream-sync.md](./streamflix-upstream-sync.md).

Primary health check: `npm run benchmark-streamflix` in `tizenflix-api/`.
