/**
 * Motion profile — TV uses shorter GPU-friendly timings; browser keeps polish.
 */

var config = require("./config.js");

var EASE_CURVE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

var BROWSER = {
  transformMs: 300,
  opacityMs: 400,
  scrollMs: 300,
  mainScrollMs: 300,
  heroDebounceMs: 400,
  fadeMs: 400,
  heroBackdropMs: 400,
  heroTrailerDelayMs: 1500,
  screenEnterMs: 280,
  screenExitMs: 220,
  zonePulseMs: 50,
  handoffMs: 280,
  kenBurnsMs: 6000,
  cardFocusScale: 1.12,
};

var TV = {
  transformMs: 200,
  opacityMs: 250,
  scrollMs: 200,
  mainScrollMs: 180,
  heroDebounceMs: 300,
  fadeMs: 300,
  heroBackdropMs: 300,
  heroTrailerDelayMs: 1200,
  screenEnterMs: 150,
  screenExitMs: 120,
  zonePulseMs: 50,
  handoffMs: 150,
  kenBurnsMs: 0,
  cardFocusScale: 1.1,
};

var ROW_ANCHOR_SPOTLIGHT_PX = 48;
var ROW_ANCHOR_FALLBACK_PX = 140;
var BROWSE_LANE_MIN_PX = 120;
var BROWSE_LANE_RATIO = 0.38;
var BROWSE_LANE_MAX_RATIO = 0.48;

var tvPerfForced = null;

function queryTvPerfOverride() {
  if (typeof window === "undefined" || !window.location || !window.location.search) return false;
  var search = window.location.search;
  return search.indexOf("tvPerf=1") !== -1 || search.indexOf("tvPerf=true") !== -1;
}

function isTvPerfMode() {
  if (tvPerfForced !== null) return tvPerfForced;
  if (queryTvPerfOverride()) return true;
  return config.isTizenClient();
}

function setTvPerfMode(enabled) {
  tvPerfForced = !!enabled;
}

function getMotionProfile() {
  return isTvPerfMode() ? TV : BROWSER;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function animationsEnabled() {
  if (prefersReducedMotion()) return false;
  return config.getUiAnimations();
}

function shouldSnapScroll(distance) {
  if (!animationsEnabled()) return true;
  if (isTvPerfMode() && Math.abs(distance) > 400) return true;
  return false;
}

function useCssRowScroll() {
  return animationsEnabled();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function applyBodyClass() {
  if (typeof document === "undefined" || !document.body) return;
  document.body.classList.toggle("tv-perf", isTvPerfMode());
  document.body.classList.toggle("animations-off", !animationsEnabled());
}

function computeBrowseLaneAnchorY(main) {
  var height = 0;
  if (main && main.clientHeight > 0) {
    height = main.clientHeight;
  } else if (typeof window !== "undefined" && window.innerHeight) {
    height = window.innerHeight;
  }
  if (height < 1) height = 720;

  var scaled = Math.round(height * BROWSE_LANE_RATIO);
  var maxAnchor = Math.round(height * BROWSE_LANE_MAX_RATIO);
  if (scaled < BROWSE_LANE_MIN_PX) scaled = BROWSE_LANE_MIN_PX;
  if (scaled > maxAnchor) scaled = maxAnchor;
  return scaled;
}

module.exports = {
  EASE_CURVE: EASE_CURVE,
  BROWSER: BROWSER,
  TV: TV,
  ROW_ANCHOR_SPOTLIGHT_PX: ROW_ANCHOR_SPOTLIGHT_PX,
  ROW_ANCHOR_FALLBACK_PX: ROW_ANCHOR_FALLBACK_PX,
  BROWSE_LANE_MIN_PX: BROWSE_LANE_MIN_PX,
  isTvPerfMode: isTvPerfMode,
  setTvPerfMode: setTvPerfMode,
  getMotionProfile: getMotionProfile,
  prefersReducedMotion: prefersReducedMotion,
  animationsEnabled: animationsEnabled,
  shouldSnapScroll: shouldSnapScroll,
  useCssRowScroll: useCssRowScroll,
  easeOutCubic: easeOutCubic,
  applyBodyClass: applyBodyClass,
  computeBrowseLaneAnchorY: computeBrowseLaneAnchorY,
};
