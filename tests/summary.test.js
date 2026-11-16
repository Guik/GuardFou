import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSiteFacts, timelineEvents, relativeTime, employeeRange, titleCaseCountry, LABELLED_LEGAL_FORMS, NAF_SECTIONS } from '../src/core/summary.js';
import { loadMessages } from './helpers/i18n.js';

const RDAP = { registeredAt: '2020-03-01T00:00:00Z', lastChangedAt: '2025-02-01T00:00:00Z', expiresAt: '2027-03-01T00:00:00Z', registrarName: 'OVH SAS' };
const LEGAL = {
  legal: { present: true },
  mandatoryMentions: { missingUniversalCount: 1, missingConditionalCount: 2 },
  companyCheck: {
    candidate: { type: 'siret', digits: '81156775900014' },
    checksumValid: true,
    registry: { found: true, name: 'PLANETE HOME SLU', status: 'A', creationDate: '2015-06-01', country: 'ESPAGNE' },
  },
};

test('buildSiteFacts keeps what the summary shows', () => {
  assert.deepEqual(buildSiteFacts({ rdapInfo: RDAP, legalAnalysis: LEGAL }), {
    domain: RDAP,
    legal: { found: true, missing: 3 },
    company: { hasNumber: true, checksumValid: true, found: true, name: 'PLANETE HOME SLU', status: 'A', creationDate: '2015-06-01', country: 'ESPAGNE' },
  });
});

test('buildSiteFacts leaves out the lookups that did not run', () => {
  assert.deepEqual(buildSiteFacts({}), { domain: null, legal: null, company: null });
  const empty = { registeredAt: null, lastChangedAt: null, expiresAt: null, registrarName: null };
  assert.equal(buildSiteFacts({ rdapInfo: empty }).domain, null);
  const noLegal = { legal: { present: false }, mandatoryMentions: null, companyCheck: { candidate: null, checksumValid: null, registry: null } };
  assert.deepEqual(buildSiteFacts({ legalAnalysis: noLegal }).legal, { found: false, missing: null });
  assert.equal(buildSiteFacts({ legalAnalysis: noLegal }).company.hasNumber, false);
});

test('timelineEvents sorts the dates and places today among them', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  const events = timelineEvents({ companyCreated: '2015-06-01', domainRegistered: RDAP.registeredAt, domainChanged: null, domainExpires: RDAP.expiresAt }, now);
  assert.deepEqual(events.map((e) => [e.key, e.future]), [
    ['companyCreated', false], ['domainRegistered', false], ['today', false], ['domainExpires', true],
  ]);
  assert.deepEqual(timelineEvents({ domainRegistered: null }, now), []);
});

test('relativeTime picks the largest whole unit', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  assert.deepEqual(relativeTime(new Date('2020-03-01T00:00:00Z'), now), { value: -6, unit: 'year' });
  assert.deepEqual(relativeTime(new Date('2027-03-01T00:00:00Z'), now), { value: 3, unit: 'month' });
  assert.deepEqual(relativeTime(new Date('2026-11-08T00:00:00Z'), now), { value: -8, unit: 'day' });
});

test('employeeRange and titleCaseCountry', () => {
  assert.equal(employeeRange('12'), '20–49');
  assert.equal(employeeRange('NN'), null);
  assert.equal(titleCaseCountry('ESPAGNE'), 'Espagne');
  assert.equal(titleCaseCountry('ROYAUME-UNI'), 'Royaume-Uni');
});

test('every labelled legal form and NAF section has a message in every locale', () => {
  for (const locale of ['en', 'fr']) {
    const messages = loadMessages(locale);
    for (const code of LABELLED_LEGAL_FORMS) assert.ok(messages[`legalForm_${code}`], `${locale} legalForm_${code}`);
    for (const letter of NAF_SECTIONS) assert.ok(messages[`nafSection_${letter}`], `${locale} nafSection_${letter}`);
  }
});
