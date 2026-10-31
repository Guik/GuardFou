import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findBrandByAlias,
  isOfficialDomain,
  looksLikeBrandPlusGenericWord,
  isNearMissSpelling,
  levenshtein,
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
