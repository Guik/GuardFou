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
{ name: 'Fnac', aliases: ['fnac'], officialDomains: ['fnac.com'], sector: 'electronics', source: 'Large French electronics and culture retailer (initial list)', verified: '2026-11-17' },
```

- `aliases`: the names a site may use for itself. Matching ignores case and accents.
- `officialDomains`: every domain the brand really uses, group sites included. A site on one of them is never flagged, and a domain that is one typo away from another brand's name is not reported either.
- `sector`: one of `SECTORS` in the same file (`diy`, `electronics`, `sport`, `marketplace`, `windshield`, `energy`, `insurance`). To add a sector, add it to `SECTORS` and to this list.
- `source`: a short English reason the brand is on the list.
- `verified`: the date (`YYYY-MM-DD`) the official domains were last checked.
- `commonWord: true` (optional): set it only when a single-word alias is an ordinary French or English word, such as Boulanger, Orange or Free. For such a brand, look-alike checks ignore its single-word aliases and never report a typo of its name, so `boulangershop.fr` or `oranges.fr` is not flagged. Multi-word aliases still count (`freemobileshop.fr` is flagged for Free Mobile), and a page that names itself as the brand is still caught. Don't set it for a brand whose single-word alias is not an ordinary word. `Chausson` is an ordinary word too, but it stays without the flag because it is the founding confirmed clone case, detected by its domain; the comment in `brands-fr.js` explains it.

### Verifying official domains

For the domain and its `.fr` and `.com` counterparts, check where each one leads:

```sh
curl -s -o /dev/null -m 10 -L -w '%{http_code} %{url_effective}' -A 'Mozilla/5.0' https://<domain>/
```

- Look at the final host. A redirect to a registrable domain that is not in the list is usually a domain of the brand too (`allianzdirect.fr` lands on `luko.eu`, "Luko by Allianz Direct"): check the page and add it.
- A 403 or 503 from bot protection is fine when the final host is the brand's own.
- For a `.fr` domain, look up the registrant in RDAP (`https://rdap.org/domain/<domain>`) and confirm it is the brand's company.
- Check the brand's official website on Wikidata (property P856) for domains you might have missed.
- Set `verified` to the date you checked.

The tests in `tests/brands.test.js` enforce the rest: a valid `sector`, a non-empty `source`, a valid `verified` date, no look-alike reported for any official domain, no alias or domain shared by two brands, and a single-word alias that is a common word (listed in `tests/fixtures/common-words.txt`) must be `commonWord: true`, except the exceptions named in the test. Add a word to that fixture only if it is a real common word.

## Adding a language

Copy `_locales/en/messages.json` to `_locales/<code>/messages.json`, translate it, and add the code to `LANGUAGES` in `src/core/i18n.js` and to the list in `src/options/options.html`. The tests check that every locale has the same keys and substitutions and is in `LANGUAGES`.

The add-on's name and description in the browser's menus always follow the browser's language, whatever is picked in the settings.

## Releasing

See [RELEASING.md](RELEASING.md).
