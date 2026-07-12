/**
 * On-screen keyboard for TV search — D-pad navigable key grid.
 */

var ROWS = [
  [{ type: "space" }, { type: "backspace" }],
  ["a", "b", "c", "d", "e", "f"],
  ["g", "h", "i", "j", "k", "l"],
  ["m", "n", "o", "p", "q", "r"],
  ["s", "t", "u", "v", "w", "x"],
  ["y", "z", "1", "2", "3", "4"],
  ["5", "6", "7", "8", "9", "0"],
];

var BACKSPACE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" class="osk-key-icon">' +
  '<path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>' +
  "</svg>";

function createKeyButton(keyDef, rowIdx, colIdx, isLastInRow, crossRight) {
  var el = document.createElement("button");
  el.type = "button";
  el.className = "osk-key focusable";

  if (keyDef.type === "space") {
    el.className += " osk-key--space";
    el.textContent = "Space";
    el.setAttribute("aria-label", "Space");
    el.setAttribute("data-osk-action", "space");
  } else if (keyDef.type === "backspace") {
    el.className += " osk-key--backspace";
    el.innerHTML = BACKSPACE_SVG;
    el.setAttribute("aria-label", "Backspace");
    el.setAttribute("data-osk-action", "backspace");
  } else {
    el.textContent = keyDef;
    el.setAttribute("aria-label", keyDef);
    el.setAttribute("data-osk-char", keyDef);
  }

  if (isLastInRow && crossRight) {
    el.setAttribute("data-cross-right", crossRight);
  }

  return el;
}

function createKeyboard(options) {
  options = options || {};
  var onChange = options.onChange || null;
  var crossRight = options.crossRight || "search-suggestions";
  var query = "";

  var root = document.createElement("div");
  root.className = "osk-keyboard";

  function emitChange() {
    if (onChange) onChange(query);
  }

  function appendChar(ch) {
    query += ch;
    emitChange();
  }

  function backspace() {
    if (!query.length) return;
    query = query.slice(0, -1);
    emitChange();
  }

  function space() {
    query += " ";
    emitChange();
  }

  function setQuery(value) {
    query = value || "";
    emitChange();
  }

  function getQuery() {
    return query;
  }

  for (var r = 0; r < ROWS.length; r++) {
    var rowDef = ROWS[r];
    var rowEl = document.createElement("div");
    rowEl.className = "osk-row";
    rowEl.setAttribute("data-focus-row", "osk-" + r);

    for (var c = 0; c < rowDef.length; c++) {
      var keyDef = typeof rowDef[c] === "string" ? rowDef[c] : rowDef[c];
      var isLast = c === rowDef.length - 1;
      var btn = createKeyButton(keyDef, r, c, isLast, crossRight);
      btn.addEventListener("click", function () {
        var action = this.getAttribute("data-osk-action");
        var ch = this.getAttribute("data-osk-char");
        if (action === "backspace") backspace();
        else if (action === "space") space();
        else if (ch) appendChar(ch);
      });
      rowEl.appendChild(btn);
    }

    root.appendChild(rowEl);
  }

  root.setQuery = setQuery;
  root.getQuery = getQuery;
  root.appendChar = appendChar;
  root.backspace = backspace;
  root.space = space;

  return root;
}

module.exports = {
  createKeyboard: createKeyboard,
};
