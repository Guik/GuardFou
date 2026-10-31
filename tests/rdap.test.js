import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDomainAgeDays, extractRegistrarName, extractDomainDates, isShortRegistrationSpan } from '../src/core/rdap.js';

const CHAUSSONCONSTRUCTION_RDAP = {
  objectClassName: 'domain',
  ldhName: 'CHAUSSONCONSTRUCTION.COM',
  entities: [
    {
      objectClassName: 'entity',
      handle: '839',
      roles: ['registrar'],
      publicIds: [{ type: 'IANA Registrar ID', identifier: '839' }],
      vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Realtime Register B.V.']]],
    },
  ],
  events: [
    { eventAction: 'registration', eventDate: '2026-08-04T08:36:30Z' },
    { eventAction: 'expiration', eventDate: '2027-08-04T08:36:30Z' },
  ],
};

test('extractRegistrarName reads the registrar entity vCard fn', () => {
  assert.equal(extractRegistrarName(CHAUSSONCONSTRUCTION_RDAP), 'Realtime Register B.V.');
});

test('extractRegistrarName returns null when there is no registrar entity', () => {
  assert.equal(extractRegistrarName({ entities: [{ roles: ['registrant'] }] }), null);
  assert.equal(extractRegistrarName({}), null);
  assert.equal(extractRegistrarName(null), null);
});

test('extractDomainAgeDays computes days since the registration event', () => {
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const days = extractDomainAgeDays({ events: [{ eventAction: 'registration', eventDate: oneDayAgo }] });
  assert.ok(days === 1 || days === 0); // allow for rounding across the boundary
});

test('extractDomainAgeDays returns null with no registration event', () => {
  assert.equal(extractDomainAgeDays({ events: [{ eventAction: 'expiration', eventDate: '2027-01-01T00:00:00Z' }] }), null);
  assert.equal(extractDomainAgeDays({}), null);
});

test('extractDomainDates reads registration, last-changed and expiration', () => {
  const dates = extractDomainDates(CHAUSSONCONSTRUCTION_RDAP);
  assert.equal(dates.registeredAt, '2026-08-04T08:36:30Z');
  assert.equal(dates.expiresAt, '2027-08-04T08:36:30Z');
  assert.equal(dates.lastChangedAt, null); // not present in this fixture
});

test('extractDomainDates handles a missing events array', () => {
  assert.deepEqual(extractDomainDates({}), { registeredAt: null, lastChangedAt: null, expiresAt: null });
});

test('isShortRegistrationSpan flags a ~1 year registration (the Chausson clone)', () => {
  assert.equal(isShortRegistrationSpan('2026-08-04T08:36:30Z', '2027-08-04T08:36:30Z'), true);
});

test('isShortRegistrationSpan does not flag a multi-year registration', () => {
  assert.equal(isShortRegistrationSpan('2020-01-01T00:00:00Z', '2030-01-01T00:00:00Z'), false);
});

test('isShortRegistrationSpan handles missing dates', () => {
  assert.equal(isShortRegistrationSpan(null, '2027-08-04T08:36:30Z'), false);
  assert.equal(isShortRegistrationSpan('2026-08-04T08:36:30Z', null), false);
});
