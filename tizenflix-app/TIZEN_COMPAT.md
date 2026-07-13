# Tizen TV compatibility checklist

Every UI change in `tizenflix-app` must pass this list before testing on hardware.

## CSS — do not use

- CSS custom properties (`var(--*)`) — invisible text on many Tizen webviews
- `gap` in flexbox — use margins on children instead
- `aspect-ratio` — use `padding-top: 56.25%` box for 16:9 video
- `grid` — partial support on older models
- Animating `width`, `height`, `margin`, `box-shadow`

## CSS — prefer

- Literal hex colors (`#141414`, `#ffffff`, `#e50914`)
- `display: -webkit-flex` **and** `display: flex`
- `transform` and `opacity` only for animations
- `.tv-focus` class with `border: 4px solid #fff` + `box-shadow: 0 0 0 4px #e50914`
- 10-foot UI: body `28px+`, buttons `min-height: 64px`

## Motion tiers

The app uses [`app/js/core/motion.js`](app/js/core/motion.js) for timing profiles:

| Profile | When | Transforms / opacity | Layout (width, margin, scroll) |
|---------|------|----------------------|--------------------------------|
| **Browser** | Laptop preview (`body.browser-dev`) | ~200–250ms | Instant snap |
| **TV** | Tizen UA or `?tvPerf=1` (`body.tv-perf`) | ~150ms | Instant snap |

**Horizontal row scroll:** use `translate3d` on `.row-track` inside `.row-track-outer` (`overflow: hidden`). Do **not** animate `scrollLeft` in rAF loops.

**Spotlight cards:** width/height change instantly on focus; poster crossfade uses `opacity` only (`.card-poster.is-swapping`).

**Hero collapse:** `transform: translateY(-24px) scaleY(0)` + `opacity`, not animated `min-height`.

**Vertical row focus:** on row change, animate `#main.scrollTop` so the focused `.content-row` lands at the row above's viewport position (spotlight mode: `48px` anchor). Use `forceAnimate` so TV does not snap large jumps.

Preview TV motion in browser: `http://localhost:3010/app/index.html?tvPerf=1`

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
