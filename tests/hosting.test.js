import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCloudflareIp, interpretIpRdap, platformFromOwner, parseReverseIpResponse, neighborDomains } from '../src/core/hosting.js';
import { getRegistrableDomain } from '../src/core/domain.js';

test('isCloudflareIp checks the published ranges', () => {
  assert.equal(isCloudflareIp('104.16.132.229'), true);
  assert.equal(isCloudflareIp('172.67.1.1'), true);
  assert.equal(isCloudflareIp('91.121.40.45'), false);
  assert.equal(isCloudflareIp('not an ip'), false);
});

// Trimmed RDAP answers, as received on 2026-11-17.
const RIPE_OVH = {
  name: 'OVH', country: 'FR',
  entities: [
    { roles: ['administrative'], vcardArray: ['vcard', [['kind', {}, 'text', 'individual'], ['fn', {}, 'text', 'Octave Klaba']]] },
    { roles: ['registrant'], vcardArray: ['vcard', [['kind', {}, 'text', 'individual'], ['fn', {}, 'text', 'OVH-MNT']]] },
  ],
};
const ARIN_VERCEL = { name: 'VERCEL-09', entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['kind', {}, 'text', 'org'], ['fn', {}, 'text', 'Vercel, Inc']]] }] };

test('interpretIpRdap names the organisation, never a contact person', () => {
  assert.deepEqual(interpretIpRdap(RIPE_OVH), { owner: 'OVH', country: 'FR' });
  assert.deepEqual(interpretIpRdap(ARIN_VERCEL), { owner: 'Vercel, Inc', country: null });
  assert.deepEqual(interpretIpRdap(null), { owner: null, country: null });
});

test('platformFromOwner recognizes hosting platforms and CDNs', () => {
  assert.equal(platformFromOwner('Vercel, Inc'), 'Vercel');
  assert.equal(platformFromOwner('Amazon Technologies Inc.'), 'Amazon');
  assert.equal(platformFromOwner('Shopify, Inc.'), 'Shopify');
  assert.equal(platformFromOwner('OVH'), null);
  assert.equal(platformFromOwner(null), null);
});

test('parseReverseIpResponse tells hostnames from error messages', () => {
  assert.deepEqual(parseReverseIpResponse('chauffages.fr\nsfrs.fr\n'), ['chauffages.fr', 'sfrs.fr']);
  assert.deepEqual(parseReverseIpResponse('No DNS A records found for 1.2.3.4'), []);
  assert.equal(parseReverseIpResponse('error check your search parameter'), null);
  assert.equal(parseReverseIpResponse('API count exceeded - Increase Quota with Membership'), null);
  assert.equal(parseReverseIpResponse(''), null);
});

test('neighborDomains groups hostnames by site and leaves out the site itself', () => {
  const hosts = ['bo.chauffage-et-climatisation.fr', 'chauffage-et-climatisation.fr', 'chauffages.fr', 'sfrs.fr', 'www.chauffages.fr', 'www.sfrs.fr'];
  assert.deepEqual(neighborDomains(hosts, 'chauffage-et-climatisation.fr', getRegistrableDomain), ['chauffages.fr', 'sfrs.fr']);
});
