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
