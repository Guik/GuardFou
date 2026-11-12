// Stand-in for browser.i18n, reading the real _locales files so tests see
// the same messages Firefox would. Import it before the module under test.
import { readFileSync } from 'node:fs';

export function loadMessages(locale) {
  return JSON.parse(readFileSync(new URL(`../../_locales/${locale}/messages.json`, import.meta.url), 'utf8'));
}

export function useLocale(locale) {
  const messages = loadMessages(locale);
  globalThis.browser = {
    ...globalThis.browser,
    i18n: {
      getUILanguage: () => locale,
      getMessage(key, substitutions = []) {
        const entry = messages[key];
        if (!entry) return '';
        return entry.message.replace(/\$(\d)/g, (_, n) => substitutions[Number(n) - 1] ?? '');
      },
    },
  };
}

useLocale('en');
