/**
 * Zone-based D-pad focus for Tizen TV — sidebar vs main, row-aware Up/Down.
 */

var motion = require("./motion.js");

var FOCUS_SELECTOR =
  "button:not(:disabled), input[type='text']:not(:disabled), a[href], [tabindex='0']";

var onFocusChange = null;
var currentEl = null;
var lastSidebarEl = null;
var rememberedMainEl = null;
var keyHandler = null;
var lastFocusRowId = null;
var lastSearchLeftEl = null;
var lastOskTopRowReturnEl = null;
var scrollAnimGen = 0;
var cachedRowAnchorY = null;
var verticalAnchorTimer = null;
var resizeHandler = null;
var resizeTimer = null;
var detailEpisodesRevealHandler = null;

var MISALIGN_THRESHOLD_PX = 32;

function invalidateRowAnchorCache() {
  cachedRowAnchorY = null;
}

function cancelVerticalAnchorTimer() {
  if (verticalAnchorTimer) {
    clearTimeout(verticalAnchorTimer);
    verticalAnchorTimer = null;
  }
}

function getLayoutSettleMs(options) {
  if (motion.prefersReducedMotion()) return 0;
  var profile = motion.getMotionProfile();
  options = options || {};
  if (options.spotlightToggled || options.browseFocusToggled) {
    return Math.max(profile.opacityMs, profile.transformMs);
  }
  return profile.opacityMs;
}

function getFocusables(root) {
  if (!root) return [];
  var nodes = root.querySelectorAll(FOCUS_SELECTOR);
  var list = [];
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (el.disabled) continue;
    if (el.offsetParent === null && el !== currentEl) continue;
    list.push(el);
  }
  return list;
}

function labelFor(el) {
  if (!el) return "";
  if (el.id === "apiBaseInput") return "API URL";
  if (el.id === "saveApiBtn") return "Save & test";
  if (el.id === "devModeBtn") return "Dev mode";
  if (el.id === "detailPlayBtn") return "Play";
  if (el.id === "detailMyListBtn") return "My List";
  if (el.id === "detailEpisodesBtn") return "Episodes";
  if (el.id === "detailBackBtn") return "Back";
  if (el.id === "btnStop") return "Stop";
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  var text = (el.textContent || "").trim();
  if (text) return text.slice(0, 40);
  return el.tagName;
}

function clearAllFocus() {
  var all = document.querySelectorAll(".tv-focus");
  for (var i = 0; i < all.length; i++) {
    all[i].classList.remove("tv-focus");
  }
}

function isInSidebar(el) {
  var sidebar = document.getElementById("sidebar");
  return !!(sidebar && el && sidebar.contains(el));
}

function getSidebarFocusables() {
  var sidebar = document.getElementById("sidebar");
  return sidebar ? getFocusables(sidebar) : [];
}

function getMainRoot() {
  return document.getElementById("main");
}

function resetMainScroll() {
  var main = getMainRoot();
  if (main) main.scrollTop = 0;
  lastFocusRowId = null;
  invalidateRowAnchorCache();
  resetAllTrackOffsets();
}

function resetAllTrackOffsets() {
  var tracks = document.querySelectorAll(".row-track");
  for (var i = 0; i < tracks.length; i++) {
    setTrackOffset(tracks[i], 0);
  }
}

function getTrackOffset(track) {
  if (!track) return 0;
  if (typeof track._scrollX === "number") return track._scrollX;
  return 0;
}

function setTrackOffset(track, offset) {
  if (!track) return;
  var x = Math.max(0, offset);
  track._scrollX = x;
  var transform = "translate3d(" + -x + "px, 0, 0)";
  track.style.webkitTransform = transform;
  track.style.transform = transform;
}

function getScrollElements(el) {
  var track = el ? el.closest(".row-track") : null;
  if (!track) return { track: null, outer: null };
  var outer = track.parentElement;
  if (outer && outer.classList.contains("row-track-outer")) {
    return { track: track, outer: outer };
  }
  return { track: track, outer: track };
}

function getMaxTrackOffset(track, outer) {
  if (!track || !outer) return 0;
  return Math.max(0, track.scrollWidth - outer.clientWidth);
}

function scrollIntoView(el) {
  if (!el || !el.getBoundingClientRect) return;

  var main = getMainRoot();
  if (!main) {
    if (el.scrollIntoView) {
      try {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (err) {
        el.scrollIntoView(false);
      }
    }
    return;
  }

  var elRect = el.getBoundingClientRect();
  var mainRect = main.getBoundingClientRect();

  if (elRect.bottom > mainRect.bottom - 16) {
    main.scrollTop += elRect.bottom - mainRect.bottom + 32;
  } else if (elRect.top < mainRect.top + 16) {
    main.scrollTop = Math.max(0, main.scrollTop - (mainRect.top - elRect.top + 32));
  }
}

function buildFocusMeta(el) {
  var rowId = getFocusRowId(el);
  var isCard = !!(el && el.classList && el.classList.contains("card"));
  return {
    rowId: rowId,
    isCard: isCard,
    tmdbId: isCard ? el.getAttribute("data-tmdb-id") : null,
    mediaType: isCard ? el.getAttribute("data-media-type") : null,
    label: labelFor(el),
  };
}

function setSidebarExpanded(expanded) {
  if (document.body) {
    var wasExpanded = document.body.classList.contains("sidebar-expanded");
    if (expanded) document.body.classList.add("sidebar-expanded");
    else document.body.classList.remove("sidebar-expanded");
    if (wasExpanded !== expanded) invalidateRowAnchorCache();
  }
}

function isInSpotlightRow(el) {
  if (!el || !el.classList || !el.classList.contains("card")) return false;
  return !!el.closest(".row-spotlight");
}

function updateSpotlightMode(el) {
  var wasSpotlight = document.body && document.body.classList.contains("home-spotlight-focus");
  var rows = document.querySelectorAll(".row-spotlight");
  for (var i = 0; i < rows.length; i++) {
    rows[i].classList.remove("is-active");
    var detailPanel = rows[i].querySelector(".row-spotlight-detail");
    if (detailPanel) detailPanel.style.paddingLeft = "";
    var cards = rows[i].querySelectorAll(".card-spotlight");
    for (var c = 0; c < cards.length; c++) {
      if (cards[c] === el) continue;
      var otherPoster = cards[c].querySelector(".card-poster");
      var portraitEl = cards[c].querySelector(".card-poster-portrait");
      var posterUrl = cards[c].getAttribute("data-poster");
      if (portraitEl && posterUrl) {
        portraitEl.style.backgroundImage = "url('" + posterUrl.replace(/'/g, "%27") + "')";
      } else if (otherPoster && posterUrl) {
        otherPoster.style.backgroundImage = "url('" + posterUrl.replace(/'/g, "%27") + "')";
      }
      if (otherPoster) otherPoster.classList.remove("is-backdrop-active");
    }
  }
  if (isInSpotlightRow(el)) {
    document.body.classList.add("home-spotlight-focus");
    var row = el.closest(".row-spotlight");
    if (row) row.classList.add("is-active");
    var posterEl = el.querySelector(".card-poster");
    var backdropLayer = el.querySelector(".card-poster-backdrop");
    var backdropUrl = el.getAttribute("data-backdrop") || el.getAttribute("data-poster");
    if (posterEl && backdropUrl) {
      if (backdropLayer) {
        backdropLayer.style.backgroundImage = "url('" + backdropUrl.replace(/'/g, "%27") + "')";
        posterEl.classList.add("is-backdrop-active");
      } else {
        posterEl.classList.add("is-swapping");
        posterEl.style.backgroundImage = "url('" + backdropUrl.replace(/'/g, "%27") + "')";
        requestAnimationFrame(function () {
          posterEl.classList.remove("is-swapping");
        });
      }
    }
    var spotlightCards = row ? row.querySelectorAll(".card-spotlight") : [];
    for (var s = 0; s < spotlightCards.length; s++) {
      if (spotlightCards[s] === el) continue;
      var otherPoster = spotlightCards[s].querySelector(".card-poster");
      if (otherPoster) otherPoster.classList.remove("is-backdrop-active");
    }
  } else {
    document.body.classList.remove("home-spotlight-focus");
  }
  var isSpotlight = document.body && document.body.classList.contains("home-spotlight-focus");
  if (wasSpotlight !== isSpotlight) invalidateRowAnchorCache();
  return wasSpotlight !== isSpotlight;
}

function isStandardBrowseCard(el) {
  if (!el || !el.classList || !el.classList.contains("card")) return false;
  if (isInSidebar(el)) return false;
  if (isInSpotlightRow(el)) return false;
  return !!el.closest(".content-row");
}

function updateBrowseFocusMode(el) {
  var wasBrowse = document.body && document.body.classList.contains("home-browse-focus");
  var isBrowse = isStandardBrowseCard(el);
  if (document.body) {
    if (isBrowse) document.body.classList.add("home-browse-focus");
    else document.body.classList.remove("home-browse-focus");
  }
  if (wasBrowse !== isBrowse) invalidateRowAnchorCache();
  return wasBrowse !== isBrowse;
}

function isFirstContentRow(el) {
  var main = getMainRoot();
  if (!main || !el) return false;
  var rowEl = el.closest(".content-row");
  if (!rowEl) return false;
  var rows = main.querySelectorAll(".content-row");
  return rows.length > 0 && rows[0] === rowEl;
}

function isHomeHeroPreviewVisible() {
  if (document.body && document.body.classList.contains("home-spotlight-focus")) {
    return false;
  }
  var main = getMainRoot();
  if (!main || !main.querySelector(".screen-home")) return false;
  var hero = main.querySelector(".hero");
  return !!(hero && hero.offsetHeight > 0);
}

function shouldSkipRowAnchorScroll(el) {
  return isFirstContentRow(el) && isHomeHeroPreviewVisible();
}

function clearNeighborDepth() {
  var cards = document.querySelectorAll(".card-is-before, .card-is-after");
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove("card-is-before", "card-is-after");
  }
}

function updateNeighborDepth(el) {
  clearNeighborDepth();
}

function animateTrackOffset(track, outer, targetOffset, duration, onComplete) {
  if (!track) return;
  var maxOffset = getMaxTrackOffset(track, outer);
  targetOffset = Math.max(0, Math.min(targetOffset, maxOffset));
  var start = getTrackOffset(track);
  var distance = targetOffset - start;
  if (Math.abs(distance) < 2) {
    setTrackOffset(track, targetOffset);
    if (onComplete) onComplete();
    return;
  }

  if (!motion.animationsEnabled()) {
    setTrackOffset(track, targetOffset);
    if (onComplete) onComplete();
    return;
  }

  scrollAnimGen += 1;
  var gen = scrollAnimGen;
  var profile = motion.getMotionProfile();
  duration = duration || profile.scrollMs;

  if (motion.useCssRowScroll()) {
    var settled = false;

    function finish() {
      if (settled || gen !== scrollAnimGen) return;
      settled = true;
      track.removeEventListener("transitionend", onTransitionEnd);
      track.classList.remove("is-css-scrolling");
      if (onComplete) onComplete();
    }

    function onTransitionEnd(e) {
      if (e.target !== track) return;
      if (e.propertyName !== "transform" && e.propertyName !== "-webkit-transform") return;
      finish();
    }

    track.classList.add("is-css-scrolling");
    track.addEventListener("transitionend", onTransitionEnd);
    setTrackOffset(track, targetOffset);
    setTimeout(finish, duration + 60);
    return;
  }

  track.classList.add("is-animating");
  var startTime = null;

  function step(timestamp) {
    if (gen !== scrollAnimGen) return;
    if (!startTime) startTime = timestamp;
    var elapsed = timestamp - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var eased = motion.easeOutCubic(progress);
    setTrackOffset(track, start + distance * eased);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      track.classList.remove("is-animating");
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(step);
}

function animateMainScroll(main, targetScroll, duration, options) {
  if (!main) return;
  options = options || {};
  targetScroll = Math.max(0, targetScroll);
  var start = main.scrollTop;
  var distance = targetScroll - start;
  if (Math.abs(distance) < 2) return;

  if (motion.prefersReducedMotion()) {
    main.scrollTop = targetScroll;
    return;
  }

  if (!options.forceAnimate && motion.shouldSnapScroll(distance)) {
    main.scrollTop = targetScroll;
    return;
  }

  scrollAnimGen += 1;
  var gen = scrollAnimGen;
  var profile = motion.getMotionProfile();
  duration = duration || profile.mainScrollMs;
  var startTime = null;

  function step(timestamp) {
    if (gen !== scrollAnimGen) return;
    if (!startTime) startTime = timestamp;
    var elapsed = timestamp - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    main.scrollTop = start + distance * eased;
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function getCardOffsetInScroller(track, card) {
  if (!track || !card) return 0;
  return card.offsetLeft;
}

function getHorizontalScrollTarget(track, outer, card, padding) {
  if (!track || !card || !outer) return getTrackOffset(track);

  var cardLeft = getCardOffsetInScroller(track, card);
  var cardWidth = card.offsetWidth;
  var viewWidth = outer.clientWidth;
  var scrollLeft = getTrackOffset(track);
  var maxOffset = getMaxTrackOffset(track, outer);

  if (!motion.animationsEnabled()) {
    var visibleLeft = cardLeft - scrollLeft;
    var visibleRight = visibleLeft + cardWidth;
    if (visibleLeft < padding) {
      return Math.max(0, cardLeft - padding);
    }
    if (visibleRight > viewWidth - padding) {
      return Math.min(maxOffset, cardLeft + cardWidth - viewWidth + padding);
    }
    return scrollLeft;
  }

  var centerOffset = cardLeft - (viewWidth - cardWidth) / 2;
  centerOffset = Math.max(0, Math.min(centerOffset, maxOffset));

  if (cardLeft <= (viewWidth - cardWidth) / 2) {
    return Math.max(0, Math.min(cardLeft - padding, maxOffset));
  }
  return centerOffset;
}

function captureRowAnchorY(el) {
  var main = getMainRoot();
  if (!main || !el) return null;
  var mainRect = main.getBoundingClientRect();
  var rowEl = el.closest(".content-row");
  if (rowEl) {
    var y = getContentRowAnchorTop(rowEl, mainRect);
    return y >= 0 ? y : null;
  }
  if (isHeroFocus(el)) {
    var hero = el.closest(".hero");
    if (hero) {
      var heroRect = hero.getBoundingClientRect();
      return heroRect.bottom - mainRect.top;
    }
  }
  return null;
}

function getContentRowAnchorTop(rowEl, mainRect) {
  if (!rowEl) return motion.ROW_ANCHOR_FALLBACK_PX;
  var title = rowEl.querySelector(".row-title");
  var refRect = title ? title.getBoundingClientRect() : rowEl.getBoundingClientRect();
  return refRect.top - mainRect.top;
}

function getRowAnchorViewportY(main, rowEl) {
  if (!main) return motion.computeBrowseLaneAnchorY(main);

  if (document.body && document.body.classList.contains("home-spotlight-focus")) {
    return motion.ROW_ANCHOR_SPOTLIGHT_PX;
  }

  if (rowEl) {
    var contentRows = main.querySelectorAll(".content-row");
    for (var i = 0; i < contentRows.length; i++) {
      if (contentRows[i] === rowEl) {
        if (i === 0) {
          return motion.computeBrowseLaneAnchorY(main);
        }
        var mainRect = main.getBoundingClientRect();
        var anchorY = getContentRowAnchorTop(contentRows[i - 1], mainRect);
        if (anchorY >= 0) return anchorY;
      }
    }
  }

  return motion.computeBrowseLaneAnchorY(main);
}

function isHeroFocus(el) {
  return !!(el && el.closest(".hero"));
}

function isContentRowMisaligned(el) {
  if (!el || !el.classList || !el.classList.contains("card")) return false;
  if (!el.closest(".content-row")) return false;
  if (isInSpotlightRow(el)) return false;
  if (shouldSkipRowAnchorScroll(el)) return false;

  var main = getMainRoot();
  if (!main) return false;

  var rowEl = el.closest(".content-row");
  var mainRect = main.getBoundingClientRect();
  var laneY = isFirstContentRow(el)
    ? motion.computeBrowseLaneAnchorY(main)
    : getRowAnchorViewportY(main, rowEl);
  var titleTop = getContentRowAnchorTop(rowEl, mainRect);
  return titleTop > laneY + MISALIGN_THRESHOLD_PX;
}

function scrollFocusRowToAnchor(el, anchorYOverride) {
  var main = getMainRoot();
  if (!main || !el) return;

  if (isHeroFocus(el)) {
    animateMainScroll(main, 0, null, { forceAnimate: true });
    return;
  }

  var rowEl = el.closest(".content-row");
  if (!rowEl) {
    scrollIntoView(el);
    return;
  }

  if (shouldSkipRowAnchorScroll(el)) {
    if (main.scrollTop > 2) {
      animateMainScroll(main, 0, null, { forceAnimate: true });
    }
    return;
  }

  var mainRect = main.getBoundingClientRect();
  var title = rowEl.querySelector(".row-title");
  var rowRect = title ? title.getBoundingClientRect() : rowEl.getBoundingClientRect();
  var rowContentTop = rowRect.top - mainRect.top + main.scrollTop;
  var anchorY;
  if (isFirstContentRow(el)) {
    anchorY = motion.computeBrowseLaneAnchorY(main);
  } else if (isInSpotlightRow(el)) {
    anchorY = motion.ROW_ANCHOR_SPOTLIGHT_PX;
  } else if (anchorYOverride != null && anchorYOverride >= 0) {
    anchorY = anchorYOverride;
  } else {
    anchorY = getRowAnchorViewportY(main, rowEl);
  }
  var targetScrollTop = Math.max(0, rowContentTop - anchorY);
  var scrollDistance = Math.abs(targetScrollTop - main.scrollTop);
  if (scrollDistance < 2 && isContentRowMisaligned(el)) {
    main.scrollTop = targetScrollTop;
    return;
  }
  var profile = motion.getMotionProfile();
  animateMainScroll(main, targetScrollTop, profile.mainScrollMs, { forceAnimate: true });
}

function scrollDetailSectionToAnchor(sectionEl) {
  var main = getMainRoot();
  if (!main || !sectionEl) return;

  var heading =
    sectionEl.querySelector(".episode-list-heading") ||
    sectionEl.querySelector(".season-tabs") ||
    sectionEl;
  var mainRect = main.getBoundingClientRect();
  var headingRect = heading.getBoundingClientRect();
  var headingTop = headingRect.top - mainRect.top + main.scrollTop;
  var anchorY = motion.computeBrowseLaneAnchorY(main);
  var targetScrollTop = Math.max(0, headingTop - anchorY);
  var profile = motion.getMotionProfile();
  animateMainScroll(main, targetScrollTop, profile.mainScrollMs, { forceAnimate: true });
}

function scrollEpisodeItemToAnchor(el) {
  var main = getMainRoot();
  if (!main || !el) return;

  var mainRect = main.getBoundingClientRect();
  var itemRect = el.getBoundingClientRect();
  var itemTop = itemRect.top - mainRect.top + main.scrollTop;
  var anchorY = motion.computeBrowseLaneAnchorY(main);
  var targetScrollTop = Math.max(0, itemTop - anchorY);
  var profile = motion.getMotionProfile();
  animateMainScroll(main, targetScrollTop, profile.mainScrollMs, { forceAnimate: true });
}

function setDetailEpisodesRevealHandler(fn) {
  detailEpisodesRevealHandler = fn || null;
}

function scheduleVerticalAnchor(el, options) {
  options = options || {};
  cancelVerticalAnchorTimer();
  scrollAnimGen += 1;
  var gen = scrollAnimGen;
  var delay = getLayoutSettleMs(options);
  var capturedAnchorY = options.capturedAnchorY;
  if (options.spotlightToggled || options.browseFocusToggled) {
    capturedAnchorY = null;
  }

  function measureAndScroll() {
    verticalAnchorTimer = null;
    if (gen !== scrollAnimGen || currentEl !== el) return;
    requestAnimationFrame(function () {
      if (gen !== scrollAnimGen || currentEl !== el) return;
      requestAnimationFrame(function () {
        if (gen !== scrollAnimGen || currentEl !== el) return;
        var detailSection = el.closest(".detail-episodes-section");
        if (detailSection) {
          if (isEpisodeItem(el)) {
            scrollEpisodeItemToAnchor(el);
          } else {
            scrollDetailSectionToAnchor(detailSection);
          }
        } else {
          scrollFocusRowToAnchor(el, capturedAnchorY);
        }
        scheduleSpotlightLayoutSync(el);
      });
    });
  }

  if (delay > 0) {
    verticalAnchorTimer = setTimeout(measureAndScroll, delay);
  } else {
    measureAndScroll();
  }
}

function getSpotlightScrollPadding(el) {
  if (indexInRow(el) === 0) return 0;
  var scrollEls = getScrollElements(el);
  var outer = scrollEls.outer;
  if (!outer) return 40;
  var viewWidth = outer.clientWidth;
  var cardWidth = el.offsetWidth || 130;
  return Math.max(40, Math.round((viewWidth - cardWidth) * 0.18));
}

function scrollRowIntoView(el, onComplete) {
  if (!el || !el.classList.contains("card")) {
    if (onComplete) onComplete();
    return;
  }
  var scrollEls = getScrollElements(el);
  var track = scrollEls.track;
  var outer = scrollEls.outer;
  if (!track || !outer) {
    if (onComplete) onComplete();
    return;
  }

  var profile = motion.getMotionProfile();
  var padding = isInSpotlightRow(el) ? getSpotlightScrollPadding(el) : 56;
  var target;
  var duration = isInSpotlightRow(el) ? profile.scrollMs + 40 : profile.scrollMs;

  target = getHorizontalScrollTarget(track, outer, el, padding);

  animateTrackOffset(track, outer, target, duration, onComplete);
}

function syncSpotlightLayout(el) {
  if (!isInSpotlightRow(el)) return;
  var row = el.closest(".row-spotlight");
  if (row && typeof row._syncSpotlightLayout === "function") {
    row._syncSpotlightLayout();
  }
}

function scheduleSpotlightLayoutSync(el) {
  if (!el || !isInSpotlightRow(el)) return;
  requestAnimationFrame(function () {
    if (currentEl !== el) return;
    requestAnimationFrame(function () {
      if (currentEl !== el) return;
      syncSpotlightLayout(el);
    });
  });
}

function scheduleScrollAfterLayout(el, rowId, needsVerticalAnchor, scrollOptions) {
  scrollOptions = scrollOptions || {};
  scrollAnimGen += 1;
  var gen = scrollAnimGen;
  var isSpotlight = isInSpotlightRow(el);

  function afterHorizontalScroll() {
    if (gen !== scrollAnimGen || currentEl !== el) return;
    if (isSpotlight) scheduleSpotlightLayoutSync(el);
  }

  function runScroll() {
    if (gen !== scrollAnimGen || currentEl !== el) return;
    if (el.classList.contains("card")) {
      scrollRowIntoView(el, afterHorizontalScroll);
    } else if (afterHorizontalScroll) {
      afterHorizontalScroll();
    }
    if (needsVerticalAnchor) {
      if (
        el.closest(".content-row") ||
        isHeroFocus(el) ||
        el.closest(".detail-episodes-section")
      ) {
        scheduleVerticalAnchor(el, scrollOptions);
      } else {
        scrollIntoView(el);
      }
    }
  }

  requestAnimationFrame(runScroll);
}

function focusElement(el) {
  if (!el) return false;

  var previousEl = currentEl;
  var previousRowId = lastFocusRowId;
  var rowId = getFocusRowId(el);
  var rowChanged = rowId !== previousRowId;
  var capturedAnchorY = rowChanged && previousEl ? captureRowAnchorY(previousEl) : null;

  clearAllFocus();
  currentEl = el;
  el.classList.add("tv-focus");

  lastFocusRowId = rowId;

  setSidebarExpanded(isInSidebar(el));
  var spotlightToggled = updateSpotlightMode(el);
  var browseFocusToggled = updateBrowseFocusMode(el);
  updateNeighborDepth(el);
  var skipRowAnchor = shouldSkipRowAnchorScroll(el);
  var needsVerticalAnchor =
    !skipRowAnchor &&
    (rowChanged ||
      spotlightToggled ||
      browseFocusToggled ||
      isContentRowMisaligned(el) ||
      isEpisodeItem(el));
  if (skipRowAnchor && rowChanged) {
    var mainRoot = getMainRoot();
    if (mainRoot && mainRoot.scrollTop > 2) {
      needsVerticalAnchor = true;
    }
  }
  scheduleScrollAfterLayout(el, rowId, needsVerticalAnchor, {
    capturedAnchorY: capturedAnchorY,
    spotlightToggled: spotlightToggled,
    browseFocusToggled: browseFocusToggled,
  });

  if (isInSidebar(el)) lastSidebarEl = el;
  if (onFocusChange) onFocusChange(buildFocusMeta(el));
  return true;
}

function getFocusRowContainer(el) {
  if (!el) return null;
  var row = el.closest("[data-focus-row]");
  if (row) return row;
  var track = el.closest(".row-track");
  if (track && track.parentElement) return track.parentElement;
  return null;
}

function getFocusRowId(el) {
  var row = getFocusRowContainer(el);
  return row ? row.getAttribute("data-focus-row") : null;
}

function getRowFocusables(rowId) {
  var main = getMainRoot();
  if (!main || !rowId) return [];
  var row = main.querySelector('[data-focus-row="' + rowId + '"]');
  if (!row) return [];
  if (row.getAttribute("data-focus-row") === "hero") {
    return getFocusables(row);
  }
  var track = row.querySelector(".row-track");
  return track ? getFocusables(track) : getFocusables(row);
}

function isHeroNavigable() {
  if (document.body && document.body.classList.contains("home-spotlight-focus")) {
    return false;
  }
  var hero = document.querySelector(".hero");
  if (!hero || hero.offsetHeight === 0) return false;
  var actions = hero.querySelector('[data-focus-row="hero"]');
  if (!actions) return false;
  return getFocusables(actions).length > 0;
}

function getOrderedRowIds() {
  var main = getMainRoot();
  if (!main) return [];
  var nodes = main.querySelectorAll("[data-focus-row]");
  var ids = [];
  for (var i = 0; i < nodes.length; i++) {
    var id = nodes[i].getAttribute("data-focus-row");
    if (!id || ids.indexOf(id) !== -1) continue;
    if (id === "hero" && !isHeroNavigable()) continue;
    ids.push(id);
  }
  return ids;
}

function indexInRow(el) {
  var rowId = getFocusRowId(el);
  var items = getRowFocusables(rowId);
  for (var i = 0; i < items.length; i++) {
    if (items[i] === el) return i;
  }
  return 0;
}

function handleSidebarNav(el, dir) {
  var nav = getSidebarFocusables();
  if (!nav.length) return null;
  var idx = nav.indexOf(el);
  if (idx === -1) idx = 0;
  if (dir === "up") return nav[(idx - 1 + nav.length) % nav.length];
  if (dir === "down") return nav[(idx + 1) % nav.length];
  return el;
}

function isSearchResultsRow(rowId) {
  return !!(rowId && rowId.indexOf("search-results-") === 0);
}

function isEpisodeItem(el) {
  return !!(el && el.classList && el.classList.contains("episode-item"));
}

function getEpisodeSiblings(el) {
  var list = el && el.closest ? el.closest(".episode-list-items") : null;
  return list ? getFocusables(list) : [];
}

function getCrossTargetRow(rowId, col) {
  var main = getMainRoot();
  if (!main || !rowId) return null;
  var row = main.querySelector('[data-focus-row="' + rowId + '"]');
  if (!row) return null;
  var track = row.querySelector(".row-track");
  var items = track ? getFocusables(track) : getFocusables(row);
  if (!items.length) return null;
  return items[Math.min(col, items.length - 1)];
}

function handleMainLeft(el) {
  if (isEpisodeItem(el)) return el;

  var items = getRowFocusables(getFocusRowId(el));
  var idx = indexInRow(el);
  if (idx > 0) return items[idx - 1];

  var crossLeft = el.getAttribute("data-cross-left");
  if (crossLeft) {
    var target = getCrossTargetRow(crossLeft, idx);
    if (target) return target;
    if (lastSearchLeftEl && document.body.contains(lastSearchLeftEl)) {
      return lastSearchLeftEl;
    }
    var fallback = getCrossTargetRow("osk-3", 0);
    if (fallback) return fallback;
  }

  var nav = getSidebarFocusables();
  if (lastSidebarEl && nav.indexOf(lastSidebarEl) !== -1) return lastSidebarEl;
  return nav.length ? nav[0] : el;
}

function handleMainRight(el) {
  if (isEpisodeItem(el)) return el;

  var items = getRowFocusables(getFocusRowId(el));
  var idx = indexInRow(el);
  if (idx < items.length - 1) return items[idx + 1];

  var crossRight = el.getAttribute("data-cross-right");
  if (crossRight) {
    if (el.classList.contains("osk-key") || el.classList.contains("search-suggestion")) {
      lastSearchLeftEl = el;
    }
    var targetCol = isSearchResultsRow(crossRight) ? 0 : idx;
    var target = getCrossTargetRow(crossRight, targetCol);
    if (target) return target;
  }

  return el;
}

function getLinearMainFocusables() {
  var main = getMainRoot();
  return main ? getFocusables(main) : [];
}

function handleMainVerticalLinear(el, dir) {
  var items = getLinearMainFocusables();
  var idx = items.indexOf(el);
  if (idx === -1) return el;
  if (dir === "up") return idx > 0 ? items[idx - 1] : el;
  if (dir === "down") return idx < items.length - 1 ? items[idx + 1] : el;
  return el;
}

function resolveCrossCol(colAttr, fallbackCol, itemsLength) {
  if (colAttr === "last") return itemsLength - 1;
  if (colAttr != null && colAttr !== "") {
    var parsed = parseInt(colAttr, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return fallbackCol;
}

function handleMainVertical(el, dir) {
  if (isEpisodeItem(el)) {
    var episodeItems = getEpisodeSiblings(el);
    var episodeIdx = episodeItems.indexOf(el);
    if (episodeIdx !== -1) {
      if (dir === "down" && episodeIdx < episodeItems.length - 1) {
        return episodeItems[episodeIdx + 1];
      }
      if (dir === "up" && episodeIdx > 0) {
        return episodeItems[episodeIdx - 1];
      }
    }
  }

  var rowId = getFocusRowId(el);
  if (!rowId) return handleMainVerticalLinear(el, dir);

  if (dir === "down" && rowId === "osk-0") {
    if (
      lastOskTopRowReturnEl &&
      document.body.contains(lastOskTopRowReturnEl) &&
      getFocusRowId(lastOskTopRowReturnEl) === "osk-1"
    ) {
      return lastOskTopRowReturnEl;
    }
  }

  if (dir === "up" && el.getAttribute("data-cross-up") === "osk-0") {
    lastOskTopRowReturnEl = el;
  }

  var crossAttr = dir === "down" ? "data-cross-down" : "data-cross-up";
  var crossRow = el.getAttribute(crossAttr);
  if (crossRow) {
    var colAttr = el.getAttribute(crossAttr + "-col");
    var targetItems = getRowFocusables(crossRow);
    if (targetItems.length) {
      var crossCol = resolveCrossCol(colAttr, indexInRow(el), targetItems.length);
      return targetItems[Math.min(crossCol, targetItems.length - 1)];
    }
  }

  var rows = getOrderedRowIds();
  var rowIdx = rows.indexOf(rowId);
  if (rowIdx === -1) return el;

  var col = indexInRow(el);
  var step = dir === "up" ? -1 : 1;
  var targetIdx = rowIdx + step;

  while (targetIdx >= 0 && targetIdx < rows.length) {
    var targetItems = getRowFocusables(rows[targetIdx]);
    if (targetItems.length) {
      return targetItems[Math.min(col, targetItems.length - 1)];
    }
    targetIdx += step;
  }
  return el;
}

function focusDefaultMain(selector) {
  resetMainScroll();
  var main = getMainRoot();
  if (!main) return false;

  var el = null;
  if (selector) {
    el = main.querySelector(selector) || document.querySelector(selector);
  }
  if (!el) el = main.querySelector(".hero .btn-play");
  if (!el) el = main.querySelector(".card");
  if (!el) {
    var focusables = getFocusables(main);
    el = focusables.length ? focusables[0] : null;
  }
  return el ? focusElement(el) : false;
}

function isInMainArea(el) {
  if (!el) el = currentEl;
  if (!el) return true;
  return !isInSidebar(el);
}

function focusSidebar(screenName) {
  setSidebarExpanded(true);
  var sidebar = document.getElementById("sidebar");
  if (!sidebar) return false;

  var el = null;
  if (screenName) {
    el = sidebar.querySelector('.nav-item[data-screen="' + screenName + '"]');
  }
  if (!el && lastSidebarEl && sidebar.contains(lastSidebarEl)) {
    el = lastSidebarEl;
  }
  if (!el) {
    var active = sidebar.querySelector(".nav-item.active");
    if (active) el = active;
  }
  if (!el) {
    var nav = getSidebarFocusables();
    el = nav.length ? nav[0] : null;
  }
  return el ? focusElement(el) : false;
}

function handleBrowseBack() {
  if (isInSidebar(currentEl)) return false;
  var router = require("./router.js");
  return focusSidebar(router.current());
}

function rememberMainFocus() {
  if (currentEl && !isInSidebar(currentEl)) {
    rememberedMainEl = currentEl;
  }
}

function restoreMainFocus() {
  if (rememberedMainEl && document.body.contains(rememberedMainEl)) {
    return focusElement(rememberedMainEl);
  }
  return focusDefaultMain();
}

var SCREEN_FOCUS = {
  home: [".hero .btn-play", ".card", "button"],
  trending: [".card", "button"],
  tv: [".card", "button"],
  movies: [".card", "button"],
  search: [".osk-key", "button"],
  settings: ["#apiBaseInput", "button"],
  mylist: [".card", "button"],
  random: ["button"],
  categories: ["button"],
};

function afterScreenRender(screenName) {
  resetMainScroll();
  var selectors = SCREEN_FOCUS[screenName];
  if (selectors) {
    var main = getMainRoot();
    if (main) {
      for (var i = 0; i < selectors.length; i++) {
        var el = main.querySelector(selectors[i]);
        if (el) {
          focusElement(el);
          return;
        }
      }
    }
  }
  if (screenName !== "detail-movie" && screenName !== "detail-tv") {
    focusDefaultMain();
  }
}

function onKeyDown(e) {
  if (document.body.classList.contains("is-playing")) return;

  var key = e.key || "";
  var code = e.keyCode;
  var isLeft = key === "ArrowLeft" || code === 37;
  var isRight = key === "ArrowRight" || code === 39;
  var isUp = key === "ArrowUp" || code === 38;
  var isDown = key === "ArrowDown" || code === 40;
  var isEnter = code === 13 || key === "Enter";

  if (!currentEl) {
    focusDefaultMain();
    if (isLeft || isRight || isUp || isDown || isEnter) e.preventDefault();
    return;
  }

  if (isEnter) {
    if (currentEl.click) currentEl.click();
    e.preventDefault();
    return;
  }

  var next = null;
  var inSidebar = isInSidebar(currentEl);

  if (inSidebar) {
    if (isUp) next = handleSidebarNav(currentEl, "up");
    else if (isDown) next = handleSidebarNav(currentEl, "down");
    else if (isRight) {
      setSidebarExpanded(false);
      try {
        require("./choreography.js").pulseZoneCross();
      } catch (err) {
        /* ignore */
      }
      focusDefaultMain();
      e.preventDefault();
      return;
    }
  } else {
    if (isDown && currentEl.id === "detailEpisodesBtn" && detailEpisodesRevealHandler) {
      var collapsedSection = document.querySelector(".detail-episodes-section.is-collapsed");
      if (collapsedSection || !document.querySelector(".detail-episodes-section.is-revealed")) {
        detailEpisodesRevealHandler();
        e.preventDefault();
        return;
      }
    }
    if (isLeft) next = handleMainLeft(currentEl);
    else if (isRight) next = handleMainRight(currentEl);
    else if (isUp) next = handleMainVertical(currentEl, "up");
    else if (isDown) next = handleMainVertical(currentEl, "down");
  }

  if (next && next !== currentEl) {
    var wasSidebar = inSidebar;
    var willSidebar = isInSidebar(next);
    if (wasSidebar !== willSidebar && !wasSidebar && willSidebar) {
      try {
        require("./choreography.js").pulseZoneCross();
      } catch (err) {
        /* ignore */
      }
    }
    focusElement(next);
  }
  if (isLeft || isRight || isUp || isDown) e.preventDefault();
}

function handleWindowResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () {
    resizeTimer = null;
    invalidateRowAnchorCache();
    var el = currentEl;
    if (!el || isInSidebar(el)) return;
    if (!el.classList.contains("card")) return;
    if (!el.closest(".content-row")) return;
    scrollFocusRowToAnchor(el, null);
    scheduleSpotlightLayoutSync(el);
  }, 150);
}

function init(cb) {
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler);
  }
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }
  onFocusChange = cb || null;
  keyHandler = onKeyDown;
  document.addEventListener("keydown", keyHandler);
  resizeHandler = handleWindowResize;
  if (typeof window !== "undefined") {
    window.addEventListener("resize", resizeHandler);
  }
}

function destroy() {
  cancelVerticalAnchorTimer();
  if (resizeTimer) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }
  if (resizeHandler && typeof window !== "undefined") {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
  clearAllFocus();
  clearNeighborDepth();
  currentEl = null;
  lastFocusRowId = null;
  setSidebarExpanded(false);
  document.body.classList.remove("home-spotlight-focus");
  document.body.classList.remove("home-browse-focus");
}

function getCurrentElement() {
  return currentEl;
}

/** @deprecated Gate test only — linear focus on a root element */
function setupFocus(root, onFocusChangeCb) {
  init(onFocusChangeCb);
  var list = getFocusables(root);
  if (list.length) focusElement(list[0]);
}

module.exports = {
  init: init,
  destroy: destroy,
  focusElement: focusElement,
  focusDefaultMain: focusDefaultMain,
  rememberMainFocus: rememberMainFocus,
  restoreMainFocus: restoreMainFocus,
  focusSidebar: focusSidebar,
  handleBrowseBack: handleBrowseBack,
  isInMainArea: isInMainArea,
  resetMainScroll: resetMainScroll,
  afterScreenRender: afterScreenRender,
  scrollDetailSectionToAnchor: scrollDetailSectionToAnchor,
  setDetailEpisodesRevealHandler: setDetailEpisodesRevealHandler,
  getFocusables: getFocusables,
  getCurrentElement: getCurrentElement,
  setupFocus: setupFocus,
};
