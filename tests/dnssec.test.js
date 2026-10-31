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

test('bogus signature (resolver SERVFAIL, RCODE 2)', () => {
  const result = interpretDnssecResponse({ Status: 2, AD: false, Answer: [] });
  assert.deepEqual(result, { signed: false, validated: false, bogus: true });
});

test('missing/malformed response does not throw', () => {
  assert.deepEqual(interpretDnssecResponse({}), { signed: false, validated: false, bogus: false });
  assert.deepEqual(interpretDnssecResponse(null), { signed: false, validated: false, bogus: false });
});
