// Wrapper over browser.i18n so core/ keeps running outside Firefox: the unit
// tests install a stand-in that reads _locales/en (see tests/helpers/i18n.js).
// Messages live in _locales/<lang>/messages.json and use $1, $2... for
// substitutions.
//
// browser.i18n always answers in Firefox's language. When the settings pick
// another one (storage.local `language`), its messages.json is loaded here
// and looked up first; browser.i18n stays the fallback for missing keys.

export const LANGUAGE_KEY = 'language';
export const LANGUAGES = ['en', 'fr'];

/** @type {{ lang: string, messages: Record<string, { message: string }> } | null} */
let chosen = null;

/**
 * Same substitution rules as browser.i18n: $1-$9, and $$ for a literal $.
 * @param {string} message
 * @param {string[]} substitutions
 */
export function formatMessage(message, substitutions) {
  return message.replace(/\$(\$|[1-9])/g, (_, c) => (c === '$' ? '$' : substitutions[Number(c) - 1] ?? ''));
}

/**
 * @param {string} key
 * @param {...(string|number)} substitutions
 */
export function t(key, ...substitutions) {
  const subs = substitutions.map(String);
  const entry = chosen?.messages[key];
  if (entry) return formatMessage(entry.message, subs);
  return globalThis.browser?.i18n?.getMessage(key, subs) || key;
}

export function uiLanguage() {
  return chosen?.lang || globalThis.browser?.i18n?.getUILanguage?.() || 'en';
}

/**
 * "a, b and c" / "a, b ou c" in the interface language.
 * @param {string[]} items
 * @param {'conjunction'|'disjunction'|'unit'} [type]
 */
export function formatList(items, type = 'conjunction') {
  return new Intl.ListFormat(uiLanguage(), { type }).format(items);
}

/**
 * Switches the interface to `lang`, or back to Firefox's language for
 * anything that isn't a bundled locale (the "" default).
 * @param {string | undefined} lang
 */
export async function useLanguage(lang) {
  if (!LANGUAGES.includes(lang)) {
    chosen = null;
    return;
  }
  const response = await fetch(globalThis.browser.runtime.getURL(`_locales/${lang}/messages.json`));
  chosen = { lang, messages: await response.json() };
}

async function loadLanguagePreference() {
  const storage = globalThis.browser?.storage;
  if (!storage) return;
  storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && LANGUAGE_KEY in changes) useLanguage(changes[LANGUAGE_KEY].newValue).catch(() => {});
  });
  const { [LANGUAGE_KEY]: lang } = await storage.local.get(LANGUAGE_KEY);
  await useLanguage(lang);
}

/** Resolves once the chosen language is loaded; t() falls back to Firefox's until then. */
export const i18nReady = loadLanguagePreference().catch(() => {});
