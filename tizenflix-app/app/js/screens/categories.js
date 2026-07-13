/**
 * Categories — browse TMDB genres.
 */

var api = require("../services/api.js");
var focus = require("../core/focus.js");
var choreography = require("../core/choreography.js");
var row = require("../components/row.js");

var selectedType = "movie";
var selectedGenre = null;

function openItem(item) {
  choreography.openDetail(item);
}

function renderGenrePicker(container) {
  container.innerHTML =
    '<div class="screen screen-categories">' +
    "<h2>Categories</h2>" +
    '<div class="settings-field" data-focus-row="cat-type">' +
    '<button type="button" id="catMoviesBtn" class="btn btn-info focusable">Movies</button> ' +
    '<button type="button" id="catTvBtn" class="btn btn-info focusable">TV Shows</button>' +
    "</div>" +
    '<div id="genreList" class="settings-provider-list loading-msg">Loading genres…</div>' +
    "</div>";

  var moviesBtn = container.querySelector("#catMoviesBtn");
  var tvBtn = container.querySelector("#catTvBtn");
  var listEl = container.querySelector("#genreList");

  function loadGenres() {
    listEl.textContent = "Loading genres…";
    api.listGenres(selectedType).then(function (data) {
      var genres = data.genres || [];
      var html = "";
      for (var i = 0; i < genres.length; i++) {
        var g = genres[i];
        html +=
          '<div class="settings-field" data-focus-row="genre-' +
          i +
          '"><button type="button" class="btn btn-play focusable genre-pick" data-id="' +
          g.id +
          '" data-name="' +
          String(g.name).replace(/"/g, "") +
          '">' +
          g.name +
          "</button></div>";
      }
      listEl.className = "settings-provider-list";
      listEl.innerHTML = html || "<p>No genres</p>";

      var picks = listEl.querySelectorAll(".genre-pick");
      for (var p = 0; p < picks.length; p++) {
        picks[p].addEventListener("click", function () {
          selectedGenre = {
            id: this.getAttribute("data-id"),
            name: this.getAttribute("data-name"),
          };
          renderGenreItems(container);
        });
      }
      focus.refresh(container);
    });
  }

  moviesBtn.addEventListener("click", function () {
    selectedType = "movie";
    selectedGenre = null;
    loadGenres();
  });
  tvBtn.addEventListener("click", function () {
    selectedType = "tv";
    selectedGenre = null;
    loadGenres();
  });

  loadGenres();
}

function renderGenreItems(container) {
  if (!selectedGenre) return renderGenrePicker(container);

  container.innerHTML =
    '<div class="screen screen-categories">' +
    "<h2>" +
    selectedGenre.name +
    "</h2>" +
    '<button type="button" id="catBackBtn" class="btn btn-info focusable">All genres</button>' +
    '<div id="genreRowHost"></div>' +
    "</div>";

  container.querySelector("#catBackBtn").addEventListener("click", function () {
    selectedGenre = null;
    renderGenrePicker(container);
  });

  var host = container.querySelector("#genreRowHost");
  host.innerHTML = '<p class="loading-msg">Loading…</p>';

  api.browseGenre(selectedGenre.id, selectedType, 1).then(function (data) {
    host.innerHTML = "";
    var items = data.items || [];
    host.appendChild(
      row.createRow(selectedGenre.name, items, openItem, { layout: "standard" })
    );
    focus.refresh(container);
  });
}

function render(container) {
  renderGenrePicker(container);
}

module.exports = {
  render: render,
};
