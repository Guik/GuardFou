# Contributing to GuardFou

## Setup

Requires Node.js 22+ and Firefox.

```sh
npm ci                # install dependencies
npm start             # launch Firefox with the extension loaded
npm test              # unit tests
npm run test:e2e      # browser tests in Chromium and Firefox (needs `npx playwright-core install chromium`, and Firefox or FIREFOX_PATH)
npm run lint          # Mozilla's extension linter
npm run build         # unsigned web-ext-artifacts/guardfou-<version>.xpi
npm run build:chrome  # web-ext-artifacts/chrome-guardfou-<version>.zip for the Chrome Web Store
```

An unsigned `.xpi` can be loaded temporarily from `about:debugging`, or installed in Firefox Developer Edition with `xpinstall.signatures.required` set to `false`. To try the extension in Chrome, see [Install](README.md#install).

Every push and pull request runs the unit tests, the browser tests and lint, and builds both packages (in the workflow run's artifacts).

## Project layout

```
src/content/      reads the page (title, links, prices…) and shows the warning banner
src/background/   runs the network lookups and keeps each tab's verdict
src/core/         pure logic, no browser APIs: scoring, brand matching, legal and SIRET checks
src/data/         known brands and their official domains, watched registrars
src/popup/        toolbar popup and identity card
src/options/      settings page
src/shared/       styles, translation helper, settings and the Chrome alias
_locales/         interface text, one messages.json per language
tests/            unit tests for src/core (node --test)
e2e/              the extension running in Chromium and Firefox
```

Keep detection logic in `src/core/` as plain functions, so it can be tested without a browser.

## Chrome compatibility

The same source runs in both browsers; nothing is built separately:

- `manifest.json` declares the background script as `scripts` (Firefox) and `service_worker` (Chrome). The lint warning about `service_worker` is expected.
- `src/shared/browser.js` aliases `chrome` to `browser` and loads first everywhere.
- `runtime.onMessage` listeners answer through `sendResponse`, because Chrome ignores a returned promise.

## Adding a brand

Add an entry to `src/data/brands-fr.js`:

```js
{ name: 'Fnac', aliases: ['fnac'], officialDomains: ['fnac.com'] },
```

`aliases` are the names the site may use; matching ignores case and accents. `officialDomains` lists every domain the brand really uses, so its own sites aren't flagged.

## Adding a language

Copy `_locales/en/messages.json` to `_locales/<code>/messages.json`, translate it, and add the code to `LANGUAGES` in `src/core/i18n.js` and to the list in `src/options/options.html`. The tests check that every locale has the same keys and substitutions and is in `LANGUAGES`.

The add-on's name and description in the browser's menus always follow the browser's language, whatever is picked in the settings.

## Releasing

See [RELEASING.md](RELEASING.md).
