import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  findBrandByAlias,
  isOfficialDomain,
  looksLikeBrandPlusGenericWord,
  isNearMissSpelling,
  levenshtein,
  findLookalikeBrand,
  getBrandClaimText,
  normalize,
} from '../src/core/brands.js';
import { BRANDS_FR, SECTORS } from '../src/data/brands-fr.js';

// Common French and English words (lowercase, no accents). A single-word
// alias found here means the brand is a common word and needs commonWord: true.
const COMMON_WORDS = readFileSync(new URL('./fixtures/common-words.txt', import.meta.url), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

// Brands that are deliberately NOT commonWord although one alias is a common
// word. "chausson" (slipper, pastry) is the founding confirmed clone case,
// chaussonconstruction.com, and only its domain gives it away, so it needs
// single-word matching. See the comment on Chausson in brands-fr.js.
const COMMON_WORD_EXCEPTIONS = new Set(['chausson']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidIsoDate = (value) => DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

test('findBrandByAlias matches the Chausson clone page title', () => {
  const brand = findBrandByAlias('Arrêt parquet stratifié - Chausson Matériaux', BRANDS_FR);
  assert.ok(brand);
  assert.equal(brand.name, 'Chausson Matériaux');
});

test('findBrandByAlias returns null when no brand is mentioned', () => {
  assert.equal(findBrandByAlias('Ma petite boutique artisanale', BRANDS_FR), null);
});

test('findBrandByAlias does not match substrings across word boundaries', () => {
  // "pointpointure.fr" should not match the "Point.P" alias "point p"/"pointp"
  assert.equal(findBrandByAlias('Bienvenue sur Pointpointure', BRANDS_FR), null);
});

test('isOfficialDomain recognises the real domain and rejects the clone', () => {
  const chausson = BRANDS_FR.find((b) => b.name === 'Chausson Matériaux');
  assert.equal(isOfficialDomain('chausson.fr', chausson), true);
  assert.equal(isOfficialDomain('chaussonconstruction.com', chausson), false);
});

test('looksLikeBrandPlusGenericWord flags the real-world clone domain', () => {
  const chausson = BRANDS_FR.find((b) => b.name === 'Chausson Matériaux');
  assert.equal(looksLikeBrandPlusGenericWord('chaussonconstruction', chausson), true);
  assert.equal(looksLikeBrandPlusGenericWord('chausson', chausson), false); // exact match, not a lookalike
  assert.equal(looksLikeBrandPlusGenericWord('unrelatedshop', chausson), false);
});

test('levenshtein distance', () => {
  assert.equal(levenshtein('chausson', 'chausson'), 0);
  assert.equal(levenshtein('chausson', 'chaussson'), 1);
  assert.equal(levenshtein('chausson', 'castorama'), 7);
});

test('isNearMissSpelling catches a one-letter-off domain but not the real one', () => {
  const chausson = BRANDS_FR.find((b) => b.name === 'Chausson Matériaux');
  assert.equal(isNearMissSpelling('chaussson', chausson), true);
  assert.equal(isNearMissSpelling('chausson', chausson), false);
});

test('isNearMissSpelling does not flag an official domain whose label has a hyphen', () => {
  const mrBricolage = BRANDS_FR.find((b) => b.name === 'Mr Bricolage');
  assert.equal(isNearMissSpelling('mr-bricolage', mrBricolage), false);
});

test('isNearMissSpelling ignores ordinary words one edit away from a short brand', () => {
  const darty = BRANDS_FR.find((b) => b.name === 'Darty');
  const fnac = BRANDS_FR.find((b) => b.name === 'Fnac');
  assert.equal(isNearMissSpelling('party', darty), false); // different first letter
  assert.equal(isNearMissSpelling('frac', fnac), false); // 4 letters: no typo tolerance
  assert.equal(isNearMissSpelling('dartty', darty), true);
});

test('findLookalikeBrand catches a clone domain even when the page never names the brand', () => {
  assert.equal(findLookalikeBrand('chaussonconstruction.com', 'chaussonconstruction', BRANDS_FR)?.name, 'Chausson Matériaux');
  assert.equal(findLookalikeBrand('chaussson.fr', 'chaussson', BRANDS_FR)?.name, 'Chausson Matériaux');
});

test('findLookalikeBrand returns null for official and unrelated domains', () => {
  assert.equal(findLookalikeBrand('chausson.fr', 'chausson', BRANDS_FR), null);
  assert.equal(findLookalikeBrand('mr-bricolage.fr', 'mr-bricolage', BRANDS_FR), null);
  assert.equal(findLookalikeBrand('lemonde.fr', 'lemonde', BRANDS_FR), null);
  assert.equal(findLookalikeBrand('party.fr', 'party', BRANDS_FR), null);
});

test('getBrandClaimText ignores the title of a page that is not a shop', () => {
  const bakery = { title: 'Boulanger artisan à Lyon - pain au levain', isLikelyShop: false };
  const news = { title: 'Fnac Darty publie ses résultats', ogSiteName: 'Le Monde.fr', isLikelyShop: false };
  assert.equal(findBrandByAlias(getBrandClaimText(bakery), BRANDS_FR), null);
  assert.equal(findBrandByAlias(getBrandClaimText(news), BRANDS_FR), null);
});

test('getBrandClaimText keeps the title on a shop and the site name everywhere', () => {
  const cloneShop = { title: 'Arrêt parquet stratifié - Chausson Matériaux', isLikelyShop: true };
  const namedSite = { title: 'Accueil', ogSiteName: 'Castorama', isLikelyShop: false };
  assert.equal(findBrandByAlias(getBrandClaimText(cloneShop), BRANDS_FR)?.name, 'Chausson Matériaux');
  assert.equal(findBrandByAlias(getBrandClaimText(namedSite), BRANDS_FR)?.name, 'Castorama');
});

test('getBrandClaimText ignores the title when the site declares its own name', () => {
  // A comparison site's guide about EDF: it names itself, so the title is about EDF.
  const guide = { title: 'Abonnement EDF : tarifs et démarches', ogSiteName: 'LesFurets', isLikelyShop: true };
  assert.equal(findBrandByAlias(getBrandClaimText(guide), BRANDS_FR), null);
  // A clone that copies the brand's site name is still caught.
  const clone = { title: 'Abonnement électricité', ogSiteName: 'EDF', isLikelyShop: true };
  assert.equal(findBrandByAlias(getBrandClaimText(clone), BRANDS_FR)?.name, 'EDF');
});

test('home-service brands catch their clones but not their own group sites', () => {
  assert.equal(findLookalikeBrand('franceparebrise-direct.fr', 'franceparebrise-direct', BRANDS_FR)?.name, 'France Pare-Brise');
  assert.equal(findLookalikeBrand('carglasss.fr', 'carglasss', BRANDS_FR)?.name, 'Carglass');
  assert.equal(findBrandByAlias('Mondial Pare-Brise', BRANDS_FR)?.name, 'Mondial Pare-Brise');
  for (const domain of ['allianzdirect.fr', 'edf-solutions-solaires.com', 'totalenergies.com', 'mondialparebrise.fr']) {
    assert.equal(findLookalikeBrand(domain, domain.split('.')[0], BRANDS_FR), null, domain);
  }
});

test('Allianz Direct and the Luko domain are Allianz official domains, not look-alikes', () => {
  const allianz = BRANDS_FR.find((b) => b.name === 'Allianz');
  assert.equal(isOfficialDomain('allianzdirect.com', allianz), true);
  assert.equal(isOfficialDomain('luko.eu', allianz), true);
  assert.equal(findLookalikeBrand('allianzdirect.com', 'allianzdirect', BRANDS_FR), null);
});

test('MAIF own domain is not a look-alike of Macif (maif is one typo from macif)', () => {
  assert.equal(findLookalikeBrand('maif.fr', 'maif', BRANDS_FR), null);
  assert.equal(findLookalikeBrand('macif.fr', 'macif', BRANDS_FR), null);
});

test('the Boulanger look-alike checks no longer fire on bakery-style domains', () => {
  assert.equal(findLookalikeBrand('boulangershop.fr', 'boulangershop', BRANDS_FR), null);
  assert.equal(findLookalikeBrand('boulanger-direct.fr', 'boulanger-direct', BRANDS_FR), null);
  assert.equal(findLookalikeBrand('boulangr.fr', 'boulangr', BRANDS_FR), null); // typo: commonWord has no typo detection
});

test('a commonWord brand is still caught when a page names itself as that brand', () => {
  assert.equal(findBrandByAlias('Boulanger', BRANDS_FR)?.name, 'Boulanger');
  assert.equal(findBrandByAlias(getBrandClaimText({ ogSiteName: 'Boulanger' }), BRANDS_FR)?.name, 'Boulanger');
});

const FREE_MOBILE = { name: 'Free Mobile', aliases: ['free mobile', 'free'], officialDomains: ['free.fr'], commonWord: true };

test('commonWord brand: look-alikes only from multi-word aliases (freeshop not flagged, freemobileshop flagged)', () => {
  assert.equal(looksLikeBrandPlusGenericWord('freeshop', FREE_MOBILE), false);
  assert.equal(findLookalikeBrand('freeshop.fr', 'freeshop', [FREE_MOBILE]), null);
  assert.equal(looksLikeBrandPlusGenericWord('freemobileshop', FREE_MOBILE), true);
  assert.equal(findLookalikeBrand('freemobileshop.fr', 'freemobileshop', [FREE_MOBILE])?.name, 'Free Mobile');
  assert.equal(findBrandByAlias('Free', [FREE_MOBILE])?.name, 'Free Mobile'); // page naming itself is unchanged
});

test('the commonWord flag is what stops freeshop: the same brand without it is flagged', () => {
  const withoutFlag = { ...FREE_MOBILE, commonWord: false };
  assert.equal(findLookalikeBrand('freeshop.fr', 'freeshop', [withoutFlag])?.name, 'Free Mobile');
});

test('commonWord brand: a one-letter-off common word is not a typo of its name', () => {
  const orange = { name: 'Orange', aliases: ['orange'], officialDomains: ['orange.fr'], commonWord: true };
  assert.equal(findLookalikeBrand('oranges.fr', 'oranges', [orange]), null);
  assert.equal(isNearMissSpelling('oranges', orange), false);
  // Same brand without the flag: "oranges" is one edit from "orange", so it is flagged.
  assert.equal(findLookalikeBrand('oranges.fr', 'oranges', [{ ...orange, commonWord: false }])?.name, 'Orange');
});

test('every brand has a sector from the allowed set, a non-empty source and a valid verified date', () => {
  for (const brand of BRANDS_FR) {
    assert.ok(SECTORS.includes(brand.sector), `${brand.name}: sector "${brand.sector}" is not in SECTORS`);
    assert.ok(typeof brand.source === 'string' && brand.source.trim().length > 0, `${brand.name}: empty source`);
    assert.ok(isValidIsoDate(brand.verified), `${brand.name}: verified "${brand.verified}" is not a YYYY-MM-DD date`);
    assert.ok(brand.officialDomains.length > 0, `${brand.name}: no official domains`);
  }
});

test('no official domain of any brand is reported as a look-alike, against the whole list', () => {
  for (const brand of BRANDS_FR) {
    for (const domain of brand.officialDomains) {
      const hit = findLookalikeBrand(domain, domain.split('.')[0], BRANDS_FR);
      assert.equal(hit, null, `${domain} (${brand.name}) is reported as a look-alike of ${hit?.name}`);
    }
  }
});

test('no alias or official domain is shared by two different brands', () => {
  const aliasOwner = new Map();
  const domainOwner = new Map();
  for (const brand of BRANDS_FR) {
    for (const alias of brand.aliases) {
      const key = normalize(alias);
      assert.ok(!aliasOwner.has(key) || aliasOwner.get(key) === brand.name,
        `alias "${alias}" is used by ${aliasOwner.get(key)} and ${brand.name}`);
      aliasOwner.set(key, brand.name);
    }
    for (const domain of brand.officialDomains) {
      assert.ok(!domainOwner.has(domain) || domainOwner.get(domain) === brand.name,
        `domain ${domain} belongs to ${domainOwner.get(domain)} and ${brand.name}`);
      domainOwner.set(domain, brand.name);
    }
  }
});

test('common-words fixture: lowercase, accent-free, no duplicates, and has the words the brief requires', () => {
  for (const word of COMMON_WORDS) assert.match(word, /^[a-z]+$/, `"${word}" is not a lowercase accent-free word`);
  assert.equal(new Set(COMMON_WORDS).size, COMMON_WORDS.length, 'duplicate words in the fixture');
  for (const word of ['orange', 'free', 'but', 'carrefour', 'boulanger', 'total']) {
    assert.ok(COMMON_WORDS.includes(word), `"${word}" should be in the fixture`);
  }
  assert.ok(!COMMON_WORDS.includes('auchan'), 'auchan is not a word and must not be in the fixture');
});

test('a brand whose single-word alias is a common word must be commonWord, except the documented exceptions', () => {
  for (const brand of BRANDS_FR) {
    if (brand.commonWord) continue;
    for (const alias of brand.aliases) {
      const key = normalize(alias);
      if (key.includes(' ') || COMMON_WORD_EXCEPTIONS.has(key)) continue;
      assert.ok(!COMMON_WORDS.includes(key), `${brand.name}: "${alias}" is a common word, set commonWord: true`);
    }
  }
});

test('the common-word exceptions are real: each is a common word on a brand that is not commonWord', () => {
  for (const key of COMMON_WORD_EXCEPTIONS) {
    assert.ok(COMMON_WORDS.includes(key), `exception "${key}" is not in the fixture`);
    const owners = BRANDS_FR.filter((b) => b.aliases.some((a) => normalize(a) === key));
    assert.ok(owners.length > 0 && owners.every((b) => !b.commonWord), `exception "${key}" should belong to a non-commonWord brand`);
  }
});

test('every commonWord brand has its single-word aliases in the common-words fixture', () => {
  for (const brand of BRANDS_FR.filter((b) => b.commonWord)) {
    const singles = brand.aliases.map(normalize).filter((key) => !key.includes(' '));
    assert.ok(singles.length > 0, `${brand.name}: commonWord with no single-word alias is pointless`);
    for (const key of singles) assert.ok(COMMON_WORDS.includes(key), `${brand.name}: "${key}" is not in the fixture`);
  }
});
