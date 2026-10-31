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

test('a bogus DNSSEC signature is a red flag', () => {
  const verdict = computeScore({ dnssec: { signed: false, validated: false, bogus: true } });
  assert.ok(verdict.reasons.some((r) => r.id === 'dnssec-bogus' && r.weight === 20));
});

test('a validated DNSSEC signature slightly lowers the score', () => {
  const verdict = computeScore({ dnssec: { signed: true, validated: true, bogus: false } });
  assert.ok(verdict.reasons.some((r) => r.id === 'dnssec-ok' && r.weight === -5));
  assert.equal(verdict.score, 0); // negative weights are clamped, not just "less red"
});

test('an unsigned zone (the common case) adds no reason either way', () => {
  const verdict = computeScore({ dnssec: { signed: false, validated: false, bogus: false } });
  assert.equal(verdict.reasons.length, 0);
});

test('a watched registrar on a brand-new domain adds a small weight', () => {
  const verdict = computeScore({ isWatchedRegistrar: true, registrarName: 'Realtime Register B.V.', domainAgeDays: 88 });
  assert.ok(verdict.reasons.some((r) => r.id === 'watched-registrar-recent-domain' && r.weight === 8));
});

test('a watched registrar alone (no age data) adds nothing', () => {
  const verdict = computeScore({ isWatchedRegistrar: true, registrarName: 'Realtime Register B.V.' });
  assert.equal(verdict.reasons.length, 0);
});

test('a watched registrar on an old domain adds nothing (registrar alone proves nothing)', () => {
  const verdict = computeScore({ isWatchedRegistrar: true, registrarName: 'Realtime Register B.V.', domainAgeDays: 365 * 10 });
  assert.ok(!verdict.reasons.some((r) => r.id === 'watched-registrar-recent-domain'));
});

test('a literal IP hostname alone is orange, and tips to red combined with another flag', () => {
  const alone = computeScore({ isIpHostname: true });
  assert.ok(alone.reasons.some((r) => r.id === 'ip-hostname' && r.weight === 45));
  assert.equal(alone.band, 'orange');

  const combined = computeScore({ isIpHostname: true, hasUserinfoAtSymbol: true });
  assert.equal(combined.band, 'red');
});

test('a userinfo @ trick is a strong red flag', () => {
  const verdict = computeScore({ hasUserinfoAtSymbol: true });
  assert.ok(verdict.reasons.some((r) => r.id === 'userinfo-at-symbol' && r.weight === 30));
});

test('a fake https token in the hostname adds a small weight', () => {
  const verdict = computeScore({ hasFakeHttpsToken: true });
  assert.ok(verdict.reasons.some((r) => r.id === 'fake-https-token' && r.weight === 10));
});

test('a // redirection in the path adds a small weight', () => {
  const verdict = computeScore({ hasRedirectionInPath: true });
  assert.ok(verdict.reasons.some((r) => r.id === 'redirection-in-path' && r.weight === 10));
});

test('a short registration span on a brand-new domain adds a small weight', () => {
  const verdict = computeScore({ isShortRegistrationSpan: true, domainAgeDays: 88 });
  assert.ok(verdict.reasons.some((r) => r.id === 'short-registration-span' && r.weight === 10));
});

test('a short registration span on an old domain adds nothing (just a normal annual renewal)', () => {
  const verdict = computeScore({ isShortRegistrationSpan: true, domainAgeDays: 365 * 10 });
  assert.ok(!verdict.reasons.some((r) => r.id === 'short-registration-span'));
});

test('none of the new structural signals fire when false/absent', () => {
  const verdict = computeScore({});
  assert.equal(verdict.reasons.length, 0);
});
