/**
 * TV episode list (stub).
 */

function create(episodes) {
  var list = document.createElement("div");
  list.className = "episode-list";
  var items = episodes || [];
  for (var i = 0; i < items.length; i++) {
    var ep = items[i];
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "episode-item secondary";
    btn.textContent = "E" + (ep.episode || i + 1) + " — " + (ep.name || "Episode");
    list.appendChild(btn);
  }
  return list;
}

module.exports = {
  create: create,
};
