import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getRegistrableDomain,
  getHostname,
  getDomainLabel,
  getSharedHostingSuffix,
  isIpAddress,
  hasUserinfoAtSymbol,
  hasFakeHttpsToken,
  hasRedirectionInPath,
  isInsecureHttp,
} from '../src/core/domain.js';

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

test('isIpAddress recognises a literal IP, not a domain', () => {
  assert.equal(isIpAddress('http://192.0.2.1/login'), true);
  assert.equal(isIpAddress('https://chausson.fr/'), false);
});

test('hasUserinfoAtSymbol catches the trusted.com@evil.com trick', () => {
  assert.equal(hasUserinfoAtSymbol('http://trusted.com@evil.com/'), true);
  assert.equal(hasUserinfoAtSymbol('http://user:pass@evil.com/'), true);
});

test('hasUserinfoAtSymbol does not false-positive on an @ in the query string', () => {
  assert.equal(hasUserinfoAtSymbol('https://example.com/search?email=a@b.com'), false);
});

test('hasUserinfoAtSymbol handles an unparsable URL gracefully', () => {
  assert.equal(hasUserinfoAtSymbol('not a url'), false);
});

test('hasFakeHttpsToken flags "https" embedded in the hostname', () => {
  assert.equal(hasFakeHttpsToken('http://https-paypal-secure.com/'), true);
  assert.equal(hasFakeHttpsToken('https://chausson.fr/'), false);
});

test('hasFakeHttpsToken ignores "https" appearing only in the path', () => {
  assert.equal(hasFakeHttpsToken('https://example.com/articles/https-explained'), false);
});

test('hasRedirectionInPath catches a spliced second URL', () => {
  assert.equal(hasRedirectionInPath('http://legit.com//evil.com/'), true);
  assert.equal(hasRedirectionInPath('https://chausson.fr/produits/parquet'), false);
});

test('isInsecureHttp flags plain HTTP, not HTTPS', () => {
  assert.equal(isInsecureHttp('http://chaussonconstruction.com/'), true);
  assert.equal(isInsecureHttp('https://chausson.fr/'), false);
});

test('isInsecureHttp handles an unparsable URL gracefully', () => {
  assert.equal(isInsecureHttp('not a url'), false);
});

test('a shared hosting subdomain is its own site, not the platform', () => {
  assert.equal(getRegistrableDomain('https://fake-chausson.myshopify.com/products/x'), 'fake-chausson.myshopify.com');
  assert.equal(getDomainLabel('fake-chausson.myshopify.com'), 'fake-chausson');
  assert.equal(getSharedHostingSuffix('https://fake-chausson.myshopify.com/'), 'myshopify.com');
  assert.equal(getSharedHostingSuffix('https://monsite.wixsite.com/boutique'), 'wixsite.com');
});

test('getSharedHostingSuffix is null for a site with its own domain', () => {
  assert.equal(getSharedHostingSuffix('https://www.chausson.fr/'), null);
  assert.equal(getSharedHostingSuffix('https://shop.example.co.uk/'), null);
  assert.equal(getSharedHostingSuffix('http://192.0.2.1/'), null);
});
