import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_PREFIX } from '../src/background/cache.js';
import { getLegalPageAnalysis, getShippingPolicyClues } from '../src/background/legal.js';

const LEGAL_HTML = `<h1>Mentions légales</h1><p>Exemple SAS, capital social 10 000 €.
  Siège : 12 rue des Lilas, 75001 Paris. SIRET : 732 829 320 00074. RCS Paris.
  Hébergeur : OVH. Directeur de la publication : Jean Dupont. contact@exemple.fr</p>`;

let stored;
let fetched;
let failingUrls;

beforeEach(() => {
  stored = {};
  fetched = [];
  failingUrls = new Set();
  globalThis.browser = {
    storage: {
      local: {
        async get(keys) {
          if (keys === null) return { ...stored };
          return Object.fromEntries([keys].flat().filter((k) => k in stored).map((k) => [k, stored[k]]));
        },
        async set(items) { Object.assign(stored, items); },
        async remove(keys) { for (const k of [keys].flat()) delete stored[k]; },
      },
    },
  };
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    if (String(url).startsWith('https://recherche-entreprises.api.gouv.fr/')) {
      return new Response(JSON.stringify({ results: [{ nom_complet: 'EXEMPLE', etat_administratif: 'A' }] }));
    }
    if (failingUrls.has(String(url))) throw new TypeError('network error');
    if (String(url).includes('blocked')) return new Response('<html><head><title>Attention Required! | Cloudflare</title></head><body>Sorry, you have been blocked</body></html>', { status: 403 });
    if (String(url).includes('challenge')) return new Response('<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>');
    return new Response(LEGAL_HTML);
  };
});

const legalPageFetches = () => fetched.filter((url) => url.startsWith('https://exemple.fr/'));

test('caches the analysis of the legal pages, not their text', async () => {
  const analysis = await getLegalPageAnalysis(['https://exemple.fr/mentions-legales'], 'fr');
  assert.equal(analysis.legal.present, true);
  assert.equal(analysis.companyCheck.candidate.digits, '73282932000074');
  assert.equal(analysis.companyCheck.registry.found, true);

  const cachedValues = Object.entries(stored).filter(([key]) => key.startsWith(`${CACHE_PREFIX}legal:`));
  assert.equal(cachedValues.length, 1);
  assert.ok(!JSON.stringify(cachedValues).includes('Jean Dupont'), 'page text must not be stored');

  const again = await getLegalPageAnalysis(['https://exemple.fr/mentions-legales'], 'fr');
  assert.deepEqual(again, analysis);
  assert.equal(legalPageFetches().length, 1, 'second call is served from the cache');
});

test('does not cache when one of the pages failed to load', async () => {
  failingUrls.add('https://exemple.fr/cgv');
  const urls = ['https://exemple.fr/mentions-legales', 'https://exemple.fr/cgv'];
  await getLegalPageAnalysis(urls, 'fr');
  await getLegalPageAnalysis(urls, 'fr');
  assert.equal(legalPageFetches().length, 4, 'both pages are fetched again on the second call');
});

test('legal pages that could not be fetched are unreadable, not missing', async () => {
  for (const url of ['https://exemple.fr/blocked/mentions-legales', 'https://exemple.fr/challenge/mentions-legales']) {
    const analysis = await getLegalPageAnalysis([url], 'fr');
    assert.equal(analysis.unreadable, true, url);
    assert.equal(analysis.legal.present, false, url);
  }
  failingUrls.add('https://exemple.fr/down');
  assert.equal((await getLegalPageAnalysis(['https://exemple.fr/down'], 'fr')).unreadable, true);
});

test('one readable page is enough: the analysis is not unreadable', async () => {
  const analysis = await getLegalPageAnalysis(['https://exemple.fr/blocked/cgv', 'https://exemple.fr/mentions-legales'], 'fr');
  assert.equal(analysis.unreadable, false);
  assert.equal(analysis.legal.present, true);
});

test('no legal link at all is not unreadable', async () => {
  assert.equal((await getLegalPageAnalysis([], 'fr')).unreadable, false);
});

test('a page blocked by bot protection is read through the tab instead', async () => {
  const viaPageCalls = [];
  const viaPage = async (url) => { viaPageCalls.push(url); return { ok: true, html: LEGAL_HTML }; };
  const analysis = await getLegalPageAnalysis(['https://exemple.fr/blocked/via-tab'], 'fr', { viaPage });
  assert.deepEqual(viaPageCalls, ['https://exemple.fr/blocked/via-tab']);
  assert.equal(analysis.unreadable, false);
  assert.equal(analysis.legal.present, true);
  assert.equal(analysis.companyCheck.candidate.digits, '73282932000074');
});

test('the tab is not asked when the direct request works or simply failed', async () => {
  const viaPageCalls = [];
  const viaPage = async (url) => { viaPageCalls.push(url); return { ok: true, html: LEGAL_HTML }; };
  await getLegalPageAnalysis(['https://exemple.fr/mentions-legales'], 'fr', { viaPage });
  failingUrls.add('https://exemple.fr/down');
  const down = await getLegalPageAnalysis(['https://exemple.fr/down'], 'fr', { viaPage });
  assert.deepEqual(viaPageCalls, [], 'cookies are only used when the site blocks the plain request');
  assert.equal(down.unreadable, true);
});

test('a block is remembered for a day instead of retried on every page', async () => {
  const urls = ['https://exemple.fr/blocked/remembered'];
  const viaPage = async () => ({ ok: false, html: '' });
  assert.equal((await getLegalPageAnalysis(urls, 'fr', { viaPage })).unreadable, true);
  assert.equal((await getLegalPageAnalysis(urls, 'fr', { viaPage })).unreadable, true);
  assert.equal(legalPageFetches().length, 1, 'the second call is answered from the cache');

  // A day later, the site is asked again.
  const now = Date.now();
  mock.method(Date, 'now', () => now + 25 * 60 * 60 * 1000);
  try {
    await getLegalPageAnalysis(urls, 'fr', { viaPage });
  } finally {
    mock.restoreAll();
  }
  assert.equal(legalPageFetches().length, 2);
});

test('a block is remembered even with the cache turned off', async () => {
  const urls = ['https://exemple.fr/blocked/no-cache'];
  globalThis.browser.storage.sync = { async get() { return { cacheDisabled: true }; } };
  await getLegalPageAnalysis(urls, 'fr');
  await getLegalPageAnalysis(urls, 'fr');
  delete globalThis.browser.storage.sync;
  assert.equal(legalPageFetches().length, 1, 'in-memory record, nothing stored');
  assert.ok(!Object.keys(stored).some((key) => key.includes('no-cache')));
});

test('a network failure is not remembered: it is retried next time', async () => {
  failingUrls.add('https://exemple.fr/down');
  await getLegalPageAnalysis(['https://exemple.fr/down'], 'fr');
  await getLegalPageAnalysis(['https://exemple.fr/down'], 'fr');
  assert.equal(legalPageFetches().length, 2);
});

test('the shipping policy is read once, then served from the cache', async () => {
  const url = 'https://exemple.fr/pages/livraison';
  const first = await getShippingPolicyClues(url);
  assert.equal(first.virtualOffice, null);
  assert.equal(fetched.filter((u) => u === url).length, 1);
  assert.deepEqual(await getShippingPolicyClues(url), first);
  assert.equal(fetched.filter((u) => u === url).length, 1);
  assert.equal(await getShippingPolicyClues(null), null);
});

test('a shipping policy that bot protection blocks is not asked again', async () => {
  const url = 'https://exemple.fr/blocked/livraison';
  assert.equal(await getShippingPolicyClues(url), null);
  assert.equal(await getShippingPolicyClues(url), null);
  assert.equal(fetched.filter((u) => u === url).length, 1);
});
