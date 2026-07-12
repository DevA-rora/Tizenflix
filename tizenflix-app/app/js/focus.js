/**
 * D-pad spatial focus for Tizen TV remotes.
 * Uses .tv-focus class only — avoids repeated .focus() calls.
 */

var FOCUS_SELECTOR = "button, input[type='text'], a, [tabindex='0']";

function getFocusables(root) {
  var nodes = root.querySelectorAll(FOCUS_SELECTOR);
  var list = [];
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (el.disabled) continue;
    if (el.offsetParent === null && el !== document.activeElement) continue;
    list.push(el);
  }
  return list;
}

function clearTvFocus(list) {
  for (var i = 0; i < list.length; i++) {
    list[i].classList.remove("tv-focus");
  }
}

function labelFor(el) {
  if (!el) return "";
  if (el.id === "apiBase") return "API URL";
  if (el.id === "saveApiBtn") return "Save & test";
  if (el.id === "playBtn") return "Play movie";
  if (el.id === "stopBtn") return "Stop";
  return el.textContent || el.tagName;
}

function setupFocus(root, onFocusChange) {
  var index = 0;

  function setFocus(i) {
    var list = getFocusables(root);
    if (!list.length) return;
    clearTvFocus(list);
    index = ((i % list.length) + list.length) % list.length;
    var el = list[index];
    el.classList.add("tv-focus");
    if (onFocusChange) onFocusChange(labelFor(el));
  }

  setFocus(0);

  document.addEventListener("keydown", function (e) {
    var list = getFocusables(root);
    if (!list.length) return;

    var key = e.key || "";
    var code = e.keyCode;

    if (key === "ArrowLeft" || code === 37) {
      setFocus(index - 1);
      e.preventDefault();
    } else if (key === "ArrowRight" || code === 39) {
      setFocus(index + 1);
      e.preventDefault();
    } else if (key === "ArrowUp" || code === 38) {
      setFocus(index - 1);
      e.preventDefault();
    } else if (key === "ArrowDown" || code === 40) {
      setFocus(index + 1);
      e.preventDefault();
    } else if (code === 13 || key === "Enter") {
      var focused = list[index];
      if (focused && focused.click) focused.click();
      e.preventDefault();
    } else if (code === 10009 || key === "Back" || key === "XF86Back") {
      e.preventDefault();
    }
  });

  return { setFocus: setFocus };
}

module.exports = { setupFocus: setupFocus, getFocusables: getFocusables };
