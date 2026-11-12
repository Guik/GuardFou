import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadMessages } from './helpers/i18n.js';

const LOCALES = readdirSync(new URL('../_locales/', import.meta.url));
const en = loadMessages('en');

function placeholders(message) {
  return [...message.matchAll(/\$(\d)/g)].map((m) => m[1]).sort().join(',');
}

test('every locale has the same keys and substitutions as English', () => {
  for (const locale of LOCALES) {
    const messages = loadMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort(), `${locale} keys`);
    for (const [key, { message }] of Object.entries(messages)) {
      assert.equal(placeholders(message), placeholders(en[key].message), `${locale}: ${key}`);
    }
  }
});

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|html)$/.test(entry.name) ? [path] : [];
  });
}

test('every message key used in the source exists', () => {
  const root = new URL('..', import.meta.url).pathname;
  const used = new Set();
  for (const file of [...sourceFiles(`${root}src`), `${root}manifest.json`]) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bt\(\s*'(\w+)'/g)) used.add(m[1]);
    for (const m of text.matchAll(/data-i18n(?:-[\w-]+)?="(\w+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/__MSG_(\w+)__/g)) used.add(m[1]);
    // Keys picked between two literals: t(cond ? 'a' : 'b').
    for (const m of text.matchAll(/\bt\([^()]*\?\s*'(\w+)'\s*:\s*'(\w+)'/g)) used.add(m[1]).add(m[2]);
  }
  const missing = [...used].filter((key) => !en[key]);
  assert.deepEqual(missing, []);
});

test('every legal-information field has a label', async () => {
  const { checkMandatoryLegalMentions } = await import('../src/core/identity.js');
  const { universal, conditional } = checkMandatoryLegalMentions('x');
  for (const field of [...universal, ...conditional]) assert.ok(en[`legalField_${field.key}`], field.key);
});

test('reasons follow the browser language', async () => {
  const { useLocale } = await import('./helpers/i18n.js');
  const { computeScore } = await import('../src/core/scoring.js');
  const signals = { matchedBrand: { name: 'Leroy Merlin', officialDomains: ['leroymerlin.fr', 'leroymerlin.com'] }, isOfficialDomain: false };
  try {
    useLocale('fr');
    assert.equal(computeScore(signals).reasons[0].message, "Le site se présente comme « Leroy Merlin » mais son domaine n'est pas leroymerlin.fr ou leroymerlin.com.");
    useLocale('en');
    assert.equal(computeScore(signals).reasons[0].message, 'The site presents itself as “Leroy Merlin” but its domain isn\'t leroymerlin.fr or leroymerlin.com.');
  } finally {
    useLocale('en');
  }
});
