import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore } from '../src/core/scoring.js';

test('allowlisted site is always green regardless of other signals', () => {
  const verdict = computeScore({ isAllowlisted: true, domainAgeDays: 1, matchedBrand: { name: 'X', officialDomains: ['x.fr'] }, isOfficialDomain: false });
  assert.equal(verdict.band, 'green');
  assert.equal(verdict.score, 0);
});

test('the Chausson clone scenario scores red', () => {
  const verdict = computeScore({
    domainAgeDays: 90, // ~3 months old
    matchedBrand: { name: 'Chausson Matériaux', officialDomains: ['chausson.fr'] },
    isOfficialDomain: false,
  });
  assert.equal(verdict.band, 'red');
  assert.ok(verdict.score >= 60);
  assert.ok(verdict.reasons.some((r) => r.id === 'brand-domain-mismatch'));
  assert.ok(verdict.reasons.some((r) => r.id === 'domain-very-new'));
});

test('the real chausson.fr scores green', () => {
  const verdict = computeScore({
    domainAgeDays: 365 * 20,
    matchedBrand: { name: 'Chausson Matériaux', officialDomains: ['chausson.fr'] },
    isOfficialDomain: true,
  });
  assert.equal(verdict.band, 'green');
  assert.equal(verdict.score, 0);
});

test('a brand-less, old, unremarkable site scores green', () => {
  const verdict = computeScore({ domainAgeDays: 365 * 10 });
  assert.equal(verdict.band, 'green');
});

test('score is capped between 0 and 100', () => {
  const verdict = computeScore({
    domainAgeDays: 10,
    matchedBrand: { name: 'X', officialDomains: ['x.fr'] },
    isOfficialDomain: false,
  });
  assert.ok(verdict.score <= 100);
});

test('unknown signals (null domain age) do not crash and add no reason', () => {
  const verdict = computeScore({ domainAgeDays: null });
  assert.equal(verdict.reasons.length, 0);
  assert.equal(verdict.band, 'green');
});
