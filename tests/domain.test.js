import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRegistrableDomain, getHostname, getDomainLabel } from '../src/core/domain.js';

test('getRegistrableDomain strips subdomains and path', () => {
  assert.equal(
    getRegistrableDomain('https://www.chaussonconstruction.com/arret-parquet-stratifie-123'),
    'chaussonconstruction.com',
  );
  assert.equal(getRegistrableDomain('https://www.chausson.fr/'), 'chausson.fr');
  assert.equal(getRegistrableDomain('shop.example.co.uk'), 'example.co.uk');
});

test('getRegistrableDomain returns null for IPs', () => {
  assert.equal(getRegistrableDomain('http://127.0.0.1/'), null);
});

test('getHostname keeps the full host', () => {
  assert.equal(getHostname('https://www.chausson.fr/x'), 'www.chausson.fr');
});

test('getDomainLabel strips the public suffix', () => {
  assert.equal(getDomainLabel('chaussonconstruction.com'), 'chaussonconstruction');
  assert.equal(getDomainLabel('chausson.fr'), 'chausson');
});
