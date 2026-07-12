/**
 * Minimal D-pad focus for TV remotes.
 * Prefer CSS .focused class over repeated .focus() calls (Tizen perf).
 */
export function setupFocus(root) {
  const selector = "button, a, input, [tabindex='0']";

  function focusables() {
    return Array.from(root.querySelectorAll(selector)).filter(
      (el) => !el.disabled && el.offsetParent !== null
    );
  }

  let index = 0;

  function setFocus(i) {
    const list = focusables();
    if (!list.length) return;
    list.forEach((el) => el.classList.remove("focused"));
    index = ((i % list.length) + list.length) % list.length;
    const el = list[index];
    el.classList.add("focused");
    el.focus({ preventScroll: true });
  }

  setFocus(0);

  document.addEventListener("keydown", (e) => {
    const list = focusables();
    if (!list.length) return;

    const key = e.key || "";
    const code = e.keyCode;

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
    } else if (code === 10009 || key === "Back" || key === "XF86Back") {
      /* Let TizenBrew handle exit; prevent accidental navigation */
      e.preventDefault();
    }
  });
}
