import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_PREFIX } from '../src/background/cache.js';
import { getLegalPageAnalysis } from '../src/background/legal.js';

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
