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

test('plain HTTP adds a small weight', () => {
  const verdict = computeScore({ isInsecureHttp: true });
  assert.ok(verdict.reasons.some((r) => r.id === 'insecure-http' && r.weight === 10));
});

test('no legal page at all adds a fixed weight', () => {
  const verdict = computeScore({ legalPageMissing: true });
  assert.ok(verdict.reasons.some((r) => r.id === 'legal-page-missing' && r.weight === 15));
});

test('incomplete legal mentions weight universal fields higher than conditional ones', () => {
  const verdict = computeScore({
    legalMentions: {
      universal: [
        { key: 'legalForm', label: 'Dénomination sociale / forme juridique', present: false },
        { key: 'siren', label: 'Numéro SIRET/SIREN', present: false },
        { key: 'address', label: 'Adresse du siège social', present: true },
      ],
      conditional: [
        { key: 'rcs', label: 'Immatriculation RCS', present: false },
        { key: 'capital', label: 'Capital social', present: false },
        { key: 'vat', label: 'Numéro de TVA intracommunautaire', present: false },
      ],
      missingUniversalCount: 2,
      missingConditionalCount: 3,
    },
  });
  const reason = verdict.reasons.find((r) => r.id === 'incomplete-legal-mentions');
  assert.ok(reason);
  assert.equal(reason.weight, 2 * 5 + 3 * 2); // 16
  // The message should name actually-missing fields, not a fixed example list.
  assert.ok(reason.message.includes('Dénomination sociale / forme juridique'));
  assert.ok(!reason.message.includes('Adresse du siège social')); // this one is present
});

test('complete legal mentions add no reason', () => {
  const verdict = computeScore({
    legalMentions: { missingUniversalCount: 0, missingConditionalCount: 0 },
  });
  assert.ok(!verdict.reasons.some((r) => r.id === 'incomplete-legal-mentions'));
});

test('legalPageMissing and legalMentions are mutually exclusive in practice', () => {
  // If both were somehow set, legalPageMissing takes priority (there's no
  // text to have checked fields against if the page itself is missing).
  const verdict = computeScore({
    legalPageMissing: true,
    legalMentions: { missingUniversalCount: 5, missingConditionalCount: 4 },
  });
  assert.ok(verdict.reasons.some((r) => r.id === 'legal-page-missing'));
  assert.ok(!verdict.reasons.some((r) => r.id === 'incomplete-legal-mentions'));
});

test('an invalid SIRET checksum adds a moderate weight', () => {
  const verdict = computeScore({ siretInvalidChecksum: true });
  assert.ok(verdict.reasons.some((r) => r.id === 'siret-invalid-checksum' && r.weight === 15));
});

test('a SIRET not found in the registry is a stronger red flag', () => {
  const verdict = computeScore({ siretNotFound: true });
  assert.ok(verdict.reasons.some((r) => r.id === 'siret-not-found' && r.weight === 25));
});

test('a closed company is the strongest of the SIRET flags', () => {
  const verdict = computeScore({ companyClosed: true, registeredCompanyName: 'CHAUSSON MATERIAUX' });
  const reason = verdict.reasons.find((r) => r.id === 'company-closed');
  assert.ok(reason);
  assert.equal(reason.weight, 30);
  assert.ok(reason.message.includes('CHAUSSON MATERIAUX'));
});

test('a SIRET belonging to a different company name is flagged', () => {
  const verdict = computeScore({ companyNameMismatch: true, registeredCompanyName: 'CHAUSSON MATERIAUX' });
  assert.ok(verdict.reasons.some((r) => r.id === 'company-name-mismatch' && r.weight === 20));
});

test('SIRET checks are mutually exclusive — only the most relevant one fires', () => {
  const verdict = computeScore({ siretInvalidChecksum: true, siretNotFound: true, companyClosed: true, companyNameMismatch: true });
  const siretReasons = verdict.reasons.filter((r) => r.id.startsWith('siret-') || r.id.startsWith('company-'));
  assert.equal(siretReasons.length, 1);
  assert.equal(siretReasons[0].id, 'siret-invalid-checksum');
});

test('none of the new structural signals fire when false/absent', () => {
  const verdict = computeScore({});
  assert.equal(verdict.reasons.length, 0);
});
