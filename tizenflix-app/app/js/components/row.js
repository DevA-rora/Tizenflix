/**
 * Horizontal content row.
 */

var card = require("./card.js");

function createRow(title, items, onSelect) {
  var row = document.createElement("section");
  row.className = "content-row";

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

module.exports = {
  createRow: createRow,
};
