/**
 * Live TV — IPTV provider picker + channel grid.
 */

var api = require("../services/api.js");
var playback = require("../services/playback.js");
var focus = require("../core/focus.js");
var row = require("../components/row.js");

var state = {
  providers: [],
  providerId: null,
  providerName: "",
  channels: [],
  view: "providers",
};

function showStatus(msg) {
  if (window.TizenflixApp && window.TizenflixApp.showStatus) {
    window.TizenflixApp.showStatus(msg);
  }
}

function playChannel(providerId, channel) {
  showStatus("Loading " + channel.name + "…");
  api
    .resolveLiveChannel(providerId, channel.id)
    .then(function (play) {
      return playback.playResolved(play, channel.name, showStatus, null, {});
    })
    .catch(function (err) {
      showStatus(err.message || String(err), true);
    });
}

function renderChannels(container) {
  state.view = "channels";
  var grouped = {};
  for (var i = 0; i < state.channels.length; i++) {
    var ch = state.channels[i];
    var g = ch.group || "Channels";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(ch);
  }
  var groups = Object.keys(grouped).sort();

  var html =
    '<div class="screen screen-live-tv">' +
    '<div class="screen-header">' +
    '<button type="button" id="liveBackBtn" class="btn btn-info focusable">← Providers</button>' +
    "<h2>" +
    state.providerName +
    "</h2>" +
    "</div>" +
    '<div id="liveChannelRows"></div>' +
    "</div>";
  container.innerHTML = html;

  container.querySelector("#liveBackBtn").addEventListener("click", function () {
    renderProviders(container);
  });

  var rowsEl = container.querySelector("#liveChannelRows");
  for (var g = 0; g < groups.length; g++) {
    var groupName = groups[g];
    var items = grouped[groupName].slice(0, 40).map(function (ch) {
      return {
        id: ch.id,
        title: ch.name,
        poster: ch.logo || "",
        type: "live",
        providerId: state.providerId,
      };
    });
    row.renderRow(rowsEl, groupName, items, function (item) {
      playChannel(item.providerId, { id: item.id, name: item.title });
    });
  }
  focus.refresh(container);
}

function renderProviders(container) {
  state.view = "providers";
  container.innerHTML =
    '<div class="screen screen-live-tv">' +
    "<h2>Live TV</h2>" +
    '<div id="liveProviderList" class="settings-provider-list loading-msg">Loading providers…</div>' +
    "</div>";

  var listEl = container.querySelector("#liveProviderList");
  api
    .getLiveProviders()
    .then(function (data) {
      state.providers = data.providers || [];
      if (!state.providers.length) {
        listEl.textContent = "No live TV providers available.";
        return;
      }
      var html = "";
      for (var i = 0; i < state.providers.length; i++) {
        var p = state.providers[i];
        html +=
          '<div class="settings-field" data-focus-row="live-p-' +
          i +
          '"><button type="button" class="btn btn-play focusable live-provider-pick" data-id="' +
          p.id +
          '" data-name="' +
          String(p.name).replace(/"/g, "") +
          '">' +
          p.name +
          " (" +
          p.language +
          ")</button></div>";
      }
      listEl.className = "settings-provider-list";
      listEl.innerHTML = html;

      var picks = listEl.querySelectorAll(".live-provider-pick");
      for (var j = 0; j < picks.length; j++) {
        picks[j].addEventListener("click", function () {
          var pid = this.getAttribute("data-id");
          var pname = this.getAttribute("data-name");
          state.providerId = pid;
          state.providerName = pname;
          listEl.textContent = "Loading channels…";
          api.getLiveChannels(pid).then(function (chData) {
            state.channels = chData.channels || [];
            if (!state.channels.length) {
              listEl.textContent = "No channels found for this provider.";
              return;
            }
            renderChannels(container);
          });
        });
      }
      focus.refresh(container);
    })
    .catch(function (err) {
      listEl.textContent = err.message || "Failed to load live TV";
    });
}

function render(container) {
  if (state.view === "channels" && state.channels.length) {
    renderChannels(container);
  } else {
    renderProviders(container);
  }
}

module.exports = {
  render: render,
  onEnter: function () {
    state.view = "providers";
    state.providerId = null;
    state.channels = [];
  },
};
