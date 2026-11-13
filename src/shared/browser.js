// Chrome only exposes the extension APIs as `chrome`; in Manifest V3 they
// return promises like Firefox's `browser`, so an alias is all the code
// needs. Loaded first everywhere: imported by the background and the pages,
// and listed before collect.js in manifest.json. Valid both as a module and
// as a classic script.
globalThis.browser ??= globalThis.chrome;
