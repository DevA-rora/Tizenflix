/**
 * My List + per-title reaction preferences (localStorage).
 */

var STORAGE_KEY = "tizenflix_mylist";
var REACTIONS_KEY = "tizenflix_reactions";

function readList() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeList(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function readReactions() {
  try {
    var raw = localStorage.getItem(REACTIONS_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function writeReactions(map) {
  localStorage.setItem(REACTIONS_KEY, JSON.stringify(map));
}

function add(item) {
  var items = readList();
  for (var i = 0; i < items.length; i++) {
    if (String(items[i].id) === String(item.id)) return;
  }
  items.push({
    id: String(item.id),
    type: item.type || "movie",
    title: item.title || "",
    poster: item.poster || null,
  });
  writeList(items);
}

function remove(id) {
  var items = readList();
  var next = [];
  for (var i = 0; i < items.length; i++) {
    if (String(items[i].id) !== String(id)) next.push(items[i]);
  }
  writeList(next);
}

function has(id) {
  var items = readList();
  for (var i = 0; i < items.length; i++) {
    if (String(items[i].id) === String(id)) return true;
  }
  return false;
}

function getAll() {
  return readList();
}

function getReaction(id) {
  var map = readReactions();
  var val = map[String(id)];
  if (val === "down" || val === "up" || val === "love") return val;
  return "none";
}

function setReaction(id, reaction) {
  var map = readReactions();
  if (!reaction || reaction === "none") {
    delete map[String(id)];
  } else {
    map[String(id)] = reaction;
  }
  writeReactions(map);
}

function toggleReaction(id, reaction) {
  var current = getReaction(id);
  if (current === reaction) {
    setReaction(id, "none");
    return "none";
  }
  setReaction(id, reaction);
  return reaction;
}

module.exports = {
  add: add,
  remove: remove,
  has: has,
  getAll: getAll,
  getReaction: getReaction,
  setReaction: setReaction,
  toggleReaction: toggleReaction,
};
