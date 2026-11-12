// Thin wrapper over browser.i18n so core/ keeps running outside Firefox:
// the unit tests install a stand-in that reads _locales/en (see
// tests/helpers/i18n.js). Messages live in _locales/<lang>/messages.json and
// use $1, $2... for substitutions.

/**
 * @param {string} key
 * @param {...(string|number)} substitutions
 */
export function t(key, ...substitutions) {
  return globalThis.browser?.i18n?.getMessage(key, substitutions.map(String)) || key;
}

export function uiLanguage() {
  return globalThis.browser?.i18n?.getUILanguage?.() || 'en';
}

/**
 * "a, b and c" / "a, b ou c" in the browser's language.
 * @param {string[]} items
 * @param {'conjunction'|'disjunction'|'unit'} [type]
 */
export function formatList(items, type = 'conjunction') {
  return new Intl.ListFormat(uiLanguage(), { type }).format(items);
}
