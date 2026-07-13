/**
 * My List — saved titles from localStorage.
 */

var mylist = require("../services/mylist.js");
var card = require("../components/card.js");
var router = require("../core/router.js");
var focus = require("../core/focus.js");
var choreography = require("../core/choreography.js");

function openItem(item) {
  choreography.openDetail(item);
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-mylist";
  container.appendChild(el);

  var items = mylist.getAll();

  if (!items.length) {
    el.innerHTML =
      '<div class="loading-msg" style="padding:48px">' +
      "<h2>My List</h2>" +
      "<p>Your saved titles will appear here.</p>" +
      "</div>";
    return;
  }

  el.innerHTML =
    '<div class="content-row" style="padding-top:48px">' +
    '<h2 class="row-title">My List</h2>' +
    '<div class="row-track" data-focus-row="mylist-row"></div>' +
    "</div>";

  var track = el.querySelector(".row-track");
  for (var i = 0; i < items.length; i++) {
    track.appendChild(card.createCard(items[i], openItem));
  }
}

module.exports = {
  render: render,
};
