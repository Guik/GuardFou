import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findBrandByAlias,
  isOfficialDomain,
  looksLikeBrandPlusGenericWord,
  isNearMissSpelling,
  levenshtein,
  findLookalikeBrand,
} from '../src/core/brands.js';
import { BRANDS_FR } from '../src/data/brands-fr.js';

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
