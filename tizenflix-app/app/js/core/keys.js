/**
 * TV remote and keyboard equivalents for navigation keys.
 */

/** Samsung Tizen Back (10009), legacy TV Back (461), Escape for browser dev. */
function isBackKey(e) {
  if (!e) return false;
  if (e.key === "Back" || e.key === "Escape") return true;
  var code = e.keyCode;
  return code === 10009 || code === 461;
}

module.exports = {
  isBackKey: isBackKey,
};
