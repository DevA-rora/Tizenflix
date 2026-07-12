/**
 * Horizontal content row (stub).
 */

function create(options) {
  var row = document.createElement("section");
  row.className = "content-row";
  row.innerHTML =
    "<h3 class=\"content-row-title\">" +
    (options.title || "Row") +
    "</h3>" +
    '<div class="content-row-track" data-row="' +
    (options.id || "") +
    '"></div>';
  return row;
}

module.exports = {
  create: create,
};
