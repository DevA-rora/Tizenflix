# Vidking-first auto playback (July 2026)

> Supersedes the Streamflix-only default in prior cuts. Playwright remains for CF/embed intercept only — not for fetching every HLS playlist.

## Default resolve (`backend=auto`)

| Step | Engine | When |
|------|--------|------|
| 1 | Vidking CDN (WingsDatabase: Oxygen-first on `profile=tizen`) | Always on auto |
| 2 | Streamflix scrapers (capped scan @ 20s, up to 5 providers) | If Vidking returns nothing usable |
| 3 | TMDB-native embeds (VixSrc, 2Embed, …) | If scrapers also fail |

Client default backend: **auto**. Client resolve timeout: **90s**.

Forced backends: `backend=vidking` | `streamflix` | `tmdb-native`.

## Client recovery

- Mid-playback CDN 403 on a Vidking source → next Vidking server (Oxygen → Titanium → …), then Streamflix providers
- Player → Server panel: pick Streamflix provider, stream source, or Vidking CDN
- Preferred Streamflix provider saved in `localStorage` (`tizenflix.preferredProvider`)

## Proxy / Hydrogen note

`moon.ironbubble.site` (Hydrogen / fmovies Yoru) rejects forged `vidking.net` Origin/Referer. The proxy uses **bare UA first** for ironbubble-family hosts; other CDNs still try Vidking headers then bare on 403.

## Provider order (English Streamflix)

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
GET /play/movie/27205?backend=vidking&profile=tizen
GET /play/movie/27205?backend=streamflix&providerId=sflix
GET /play/movie/27205?backend=streamflix&preferredProviderId=ridomovies
GET /play/movie/27205?backend=tmdb-native&sources=vixsrc
```

## Maintenance

When a Streamflix provider breaks, sync from upstream — see [streamflix-upstream-sync.md](./streamflix-upstream-sync.md).

Primary health check: `npm run benchmark-streamflix` in `tizenflix-api/`.
