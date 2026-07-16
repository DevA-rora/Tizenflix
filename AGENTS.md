# AGENTS.md

## Overview
Netflix-style streaming for Samsung TVs via TizenBrew (educational purposes only). The monorepo has a TV SPA that talks over LAN to an API which resolves streams (Vidking/WingsDatabase, Streamflix scrapers, TMDB-native embeds) and serves TMDB catalog, proxy, progress, and download endpoints.

## Tech Stack
- Backend: Node.js >=18, TypeScript ^5.8, Express ^5.1 (Vitest + Playwright)
- Frontend: Vanilla JS TizenBrew SPA, esbuild-bundled to ES5 IIFE (not React)
- Database: none — progress, jobs, and provider health are local JSON under `tizenflix-api/data/`

## Commands
Root `package.json` is TizenBrew LAN-dev module metadata only. Real commands live in packages:

- Install API: `cd tizenflix-api && npm install` (postinstall installs Playwright Chromium; set `TMDB_API_KEY` in `.env`)
- Install app: `cd tizenflix-app && npm install`
- Dev API: `cd tizenflix-api && npm run dev` (auto-detects LAN IP; works on Linux + macOS)
- Dev API (manual IP): `cd tizenflix-api && PUBLIC_BASE=http://<LAN-IP>:8790 npm run api`
- Dev app: `cd tizenflix-app && npm start` (builds bundles, serves `:3010`)
- Test: `cd tizenflix-api && npm test`
- Lint: none configured in this repo

## Project Structure
- `tizenflix-app/` — TV client (`app/js/screens`, `components`, `player`, `core`; CSS under `app/css`; bundles in `app/dist`)
- `tizenflix-api/` — API (`src/server/register-routes.ts`, `src/tmdb`, `src/streamflix`, `src/proxy`, `src/normalize`, `src/store`, `tests/`)
- `lab/` — archived Vidking iframe harness
- `docs/` — TV setup, Streamflix sync, research notes

## Conventions
- Prefer named exports (notable exception: `tizenflix-api/vitest.config.ts`)
- API TypeScript is ESM; import paths use `.js` extensions
- HTTP errors are inline `res.status(...).json({ error: ... })` in `tizenflix-api/src/server/register-routes.ts`
- API tests live in `tizenflix-api/tests/` (Vitest)
- After editing `tizenflix-app/app/js/**`, run `npm run build` before TV testing (TV loads `app/dist/*.bundle.js`)
- Follow `tizenflix-app/TIZEN_COMPAT.md` (no CSS vars / `gap` / `grid` / `aspect-ratio` on TV)
- **CRITICAL COMPATIBILITY NOTE**: The `esbuild` target in `tizenflix-app/package.json` **MUST** be set to `es5` (not `es2015`). Tizen TVs use older Chromium engines that throw fatal syntax errors on ES6 features (like arrow functions in IIFE wrappers or object property shorthands) causing the app to freeze on the "Loading Tizenflix..." screen.

## Do not touch
- `tizenflix-api/data/` — runtime state (gitignored)
- `tizenflix-api/dist/` — `tsc` output
- `tizenflix-app/app/dist/*.bundle.js` — esbuild output (edit sources, rebuild)
- `tizenflix-app/app/lib/hls.min.js` — vendored third-party
- `lab/` — legacy; prefer `tizenflix-app` / `tizenflix-api`
