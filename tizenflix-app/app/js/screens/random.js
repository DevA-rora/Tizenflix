/**
 * Random — pick a title from the catalog and open its detail page.
 */

var api = require("../services/api.js");
var router = require("../core/router.js");

function pickRandom(items) {
  if (!items || !items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function render(container) {
  var el = document.createElement("div");
  el.className = "screen screen-random";
  el.innerHTML = '<div class="loading-msg">Finding something to watch…</div>';
  container.appendChild(el);

  api
    .browseRows()
    .then(function (data) {
      var rows = data.rows || [];
      if (!rows.length) throw new Error("No browse rows");
      var rowDef = pickRandom(rows);
      return api.browseRow(rowDef.id).then(function (rowData) {
        return pickRandom(rowData.items || []);
      });
    })
    .then(function (item) {
      if (!item) throw new Error("No titles available");
      router.replace("home");
      if (window.TizenflixApp && window.TizenflixApp.setSidebarActive) {
        window.TizenflixApp.setSidebarActive("home");
      }
      if (item.type === "tv") {
        router.navigate("detail-tv", { tmdbId: item.id, title: item.title });
      } else {
        router.navigate("detail-movie", { tmdbId: item.id, title: item.title });
      }
    })
    .catch(function (err) {
      el.innerHTML =
        '<div class="error-banner">Could not pick a random title: ' +
        (err.message || err) +
        "</div>";
    });
}

module.exports = {
  render: render,
};
