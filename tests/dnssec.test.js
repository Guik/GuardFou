import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretDnssecResponse } from '../src/core/dnssec.js';

test('unsigned zone (no DNSKEY answers)', () => {
  const result = interpretDnssecResponse({ Status: 0, AD: false, Answer: [] });
  assert.deepEqual(result, { signed: false, validated: false, bogus: false });
});

test('signed and validated zone (AD flag set)', () => {
  const result = interpretDnssecResponse({
    Status: 0,
    AD: true,
    Answer: [{ name: 'chausson.fr.', type: 48, data: 'fake-dnskey-data' }],
  });
  assert.deepEqual(result, { signed: true, validated: true, bogus: false });
});

test('signed but not validated (DNSKEY present, AD false)', () => {
  const result = interpretDnssecResponse({
    Status: 0,
    AD: false,
    Answer: [{ name: 'example.fr.', type: 48, data: 'x' }],
  });
  assert.deepEqual(result, { signed: true, validated: false, bogus: false });
});

test('bogus signature: SERVFAIL that answers fine with checking disabled', () => {
  const result = interpretDnssecResponse(
    { Status: 2, AD: false },
    { Status: 0, AD: false, Answer: [{ name: 'dnssec-failed.org.', type: 48, data: 'x' }] },
  );
  assert.deepEqual(result, { signed: true, validated: false, bogus: true });
});

test('SERVFAIL that also fails with checking disabled is a broken nameserver, not bogus', () => {
  assert.deepEqual(interpretDnssecResponse({ Status: 2 }, { Status: 2 }), { signed: false, validated: false, bogus: false });
  assert.deepEqual(interpretDnssecResponse({ Status: 2 }), { signed: false, validated: false, bogus: false });
});

test('missing/malformed response does not throw', () => {
  assert.deepEqual(interpretDnssecResponse({}), { signed: false, validated: false, bogus: false });
  assert.deepEqual(interpretDnssecResponse(null), { signed: false, validated: false, bogus: false });
});
