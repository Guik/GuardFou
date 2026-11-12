import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { loadMessages } from './helpers/i18n.js';
import { t, uiLanguage, formatList, formatMessage, useLanguage, LANGUAGES } from '../src/core/i18n.js';

test('formatMessage follows the browser.i18n substitution rules', () => {
  assert.equal(formatMessage('$1 sur $2', ['3', '5']), '3 sur 5');
  assert.equal(formatMessage('$$1 is $1', ['ten']), '$1 is ten');
  assert.equal(formatMessage('missing: $2', ['a']), 'missing: ');
});

test('the language list matches the bundled locales', () => {
  assert.deepEqual([...LANGUAGES].sort(), readdirSync(new URL('../_locales/', import.meta.url)).sort());
});

test('a chosen language overrides Firefox, and "" goes back to it', async () => {
  globalThis.browser.runtime = { getURL: (path) => path };
  globalThis.fetch = async (path) => ({ json: async () => loadMessages(path.split('/')[1]) });

  assert.equal(t('bandRed'), loadMessages('en').bandRed.message);

  await useLanguage('fr');
  assert.equal(uiLanguage(), 'fr');
  assert.equal(t('bandRed'), loadMessages('fr').bandRed.message);
  assert.equal(t('cardCompanyNumberFound', 42), formatMessage(loadMessages('fr').cardCompanyNumberFound.message, ['42']));
  assert.equal(formatList(['a', 'b'], 'disjunction'), 'a ou b');

  await useLanguage('');
  assert.equal(uiLanguage(), 'en');
  assert.equal(t('bandRed'), loadMessages('en').bandRed.message);
});
