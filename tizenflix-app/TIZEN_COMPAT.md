# Tizen TV compatibility checklist

Every UI change in `tizenflix-app` must pass this list before testing on hardware.

## CSS — do not use

- CSS custom properties (`var(--*)`) — invisible text on many Tizen webviews
- `gap` in flexbox — use margins on children instead
- `aspect-ratio` — use `padding-top: 56.25%` box for 16:9 video
- `grid` — partial support on older models
- Animating `width`, `height`, `margin`, `box-shadow` on main layout elements

## CSS — prefer

- Literal hex colors (`#000000`, `#141414`, `#ffffff`, `#e50914`)
- `display: -webkit-flex` **and** `display: flex`
- `transform` and `opacity` only for animations
- `.tv-focus` class with `border: 4px solid #fff` + `box-shadow: 0 0 0 4px #e50914`
- 10-foot UI: body `28px+`, buttons `min-height: 64px`

## Motion tiers

The app uses [`app/js/core/motion.js`](app/js/core/motion.js) for timing profiles:

| Profile | When | Transforms / opacity | Layout (width, margin, scroll) |
|---------|------|----------------------|--------------------------------|
| **Browser** | Laptop preview (`body.browser-dev`) | ~200–280ms | Instant snap |
| **TV** | Tizen UA or `?tvPerf=1` (`body.tv-perf`) | ~150ms | Instant snap |

**Horizontal row scroll:** set target `translate3d` once on `.row-track`; let CSS `transition: transform` run on the compositor. Do **not** combine rAF transform loops with CSS transition on the same property. Use `.row-track.is-animating` only when rAF fallback is needed.

**Spotlight cards:** width/height change instantly on focus; poster crossfade uses dual layers (`.card-poster-portrait` / `.card-poster-backdrop`) with `opacity` only.

**Hero takeover:** When a browse card is focused on home, the hero banner stays visible and cross-fades title/backdrop after ~400ms dwell; trailer preview starts after ~1.5s if available. Spotlight rows collapse the hero and use the inline spotlight panel instead.

**Hero collapse:** `transform: translateY(-24px) scaleY(0)` + `opacity`, not animated `min-height`. Applied via `body.home-spotlight-focus` only.

**Browse lane anchor:** First content row docks at `computeBrowseLaneAnchorY(#main)` — ~38% of main viewport height, clamped between 120px and 48% of height. Row 2+ dock at the previous row's title Y. Re-anchors when a card row is misaligned by more than 32px (covers hero→row1, detail back, browse-only screens).

**Vertical row focus:** on row change or misalignment, animate `#main.scrollTop` so the focused `.content-row` title lands at the browse lane (spotlight mode: `48px` anchor). Use `forceAnimate` so TV does not snap large jumps. Window resize invalidates anchor cache and re-anchors the focused row.

**Screen transitions:** `#screen` uses `opacity` + `translateY` enter/exit via [`app/js/core/choreography.js`](app/js/core/choreography.js). Initial load skips exit animation.

**Detail handoff:** `#transition-shell` overlay morphs focused card poster to full-bleed before detail screen renders. Falls back to screen fade when no card is focused.

Preview TV motion in browser: `http://localhost:3010/app/index.html?tvPerf=1`

## Animation test checklist

| Step | Browser | `?tvPerf=1` |
|------|---------|-------------|
| Down from hero to row 1 | Hero collapses; row 1 docks in browse lane | Shorter scroll, instant hero collapse |
| Left/Right on row 1 (aligned) | Horizontal scroll only; no vertical jitter | Same |
| Down to row 2, Up to row 1 | Row docks at previous row title Y | Same |
| Back from detail | Focus restored; row re-anchors after scroll reset | Same |
| Trending/TV/Movies (no hero) | First row docks to browse lane on focus | Same |
| Left/Right in standard row | Lane scrolls smoothly; neighbors dim | Shorter timing, no jank |
| Left/Right in spotlight row | Backdrop crossfade on focused card | Instant width snap, opacity crossfade |
| Up/Down between rows | Hero updates; vertical scroll animates | Hero debounce 80ms |
| Enter on card → detail | Handoff morph + detail content slide-up | 150ms handoff + fade |
| Back from detail | Screen fade; focus restored | Same, shorter |
| Sidebar ↔ main | Zone pulse on `#main` | 50ms pulse |
| `prefers-reduced-motion` | All motion snaps instantly | All motion snaps instantly |

## JavaScript — do not use

- `<script type="module">` or `import`/`export` in the TV bundle
- Optional chaining (`?.`) or nullish coalescing (`??`)
- `AbortSignal.timeout()`
- `Array.find()` / `Array.includes()` without polyfill (use `for` loops for max compat)

## JavaScript — use

- Single bundled file: `npm run build` → `app/dist/app.bundle.js`
- esbuild target: `es2015`
- `Promise` + `fetch` with manual timeout via `Promise.race`
- D-pad: `.tv-focus` class only (avoid repeated `.focus()`)

## Build before TV test

```bash
cd tizenflix-app
npm install
npm run build
npm start
```

## Video

- Hide `.video-wrap` until playback starts
- Add `controls` attribute only after manifest parses / play begins
