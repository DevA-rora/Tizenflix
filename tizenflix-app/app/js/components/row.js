/**
 * Horizontal content row.
 */

var card = require("./card.js");

var rowCounter = 0;

function createRow(title, items, onSelect) {
  rowCounter += 1;
  var row = document.createElement("section");
  row.className = "content-row";
  row.setAttribute("data-focus-row", "row-" + rowCounter);

  var heading = document.createElement("h2");
  heading.className = "row-title";
  heading.textContent = title;
  row.appendChild(heading);

  var track = document.createElement("div");
  track.className = "row-track";

  for (var i = 0; i < items.length; i++) {
    track.appendChild(card.createCard(items[i], onSelect));
  }

  row.appendChild(track);
  return row;
}

function resetRowCounter() {
  rowCounter = 0;
}

module.exports = {
  createRow: createRow,
  resetRowCounter: resetRowCounter,
};
