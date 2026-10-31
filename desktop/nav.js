'use strict';
// The desktop window may only show MathPath's own local page.
// Anything else (links, redirects, window.open) is blocked.
const { pathToFileURL } = require('url');

function isAllowedNavigation(url, appIndexPath) {
  try {
    return new URL(url).href.split('#')[0] === pathToFileURL(appIndexPath).href;
  } catch (e) {
    return false;
  }
}

module.exports = { isAllowedNavigation };
