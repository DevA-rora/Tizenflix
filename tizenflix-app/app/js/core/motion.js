/**
 * Motion profile — TV uses shorter GPU-friendly timings; browser keeps polish.
 */

var config = require("./config.js");

var BROWSER = {
  transformMs: 250,
  opacityMs: 250,
  scrollMs: 280,
  mainScrollMs: 300,
  heroDebounceMs: 150,
  fadeMs: 120,
  heroBackdropMs: 400,
};

var TV = {
  transformMs: 150,
  opacityMs: 150,
  scrollMs: 150,
  mainScrollMs: 140,
  heroDebounceMs: 80,
  fadeMs: 80,
  heroBackdropMs: 250,
};

var ROW_ANCHOR_SPOTLIGHT_PX = 48;
var ROW_ANCHOR_FALLBACK_PX = 140;

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

function shouldSnapScroll(distance) {
  if (prefersReducedMotion()) return true;
  if (isTvPerfMode() && Math.abs(distance) > 400) return true;
  return false;
}

function applyBodyClass() {
  if (typeof document === "undefined" || !document.body) return;
  document.body.classList.toggle("tv-perf", isTvPerfMode());
}

module.exports = {
  BROWSER: BROWSER,
  TV: TV,
  ROW_ANCHOR_SPOTLIGHT_PX: ROW_ANCHOR_SPOTLIGHT_PX,
  ROW_ANCHOR_FALLBACK_PX: ROW_ANCHOR_FALLBACK_PX,
  isTvPerfMode: isTvPerfMode,
  setTvPerfMode: setTvPerfMode,
  getMotionProfile: getMotionProfile,
  prefersReducedMotion: prefersReducedMotion,
  shouldSnapScroll: shouldSnapScroll,
  applyBodyClass: applyBodyClass,
};
