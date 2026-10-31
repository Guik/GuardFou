import { parse } from '../../vendor/tldts.min.js';

/**
 * Registrable domain (eTLD+1) for a URL or hostname, e.g.
 * "www.shop.chausson.fr" -> "chausson.fr". Returns null for IPs/localhost.
 * @param {string} input
 * @returns {string|null}
 */
export function getRegistrableDomain(input) {
  return parse(input, { allowPrivateDomains: false }).domain ?? null;
}

/**
 * Full hostname for a URL or hostname.
 * @param {string} input
 * @returns {string|null}
 */
export function getHostname(input) {
  return parse(input, { allowPrivateDomains: false }).hostname ?? null;
}

/**
 * The domain label without its public suffix, e.g. "chausson.fr" -> "chausson".
 * @param {string} input
 * @returns {string|null}
 */
export function getDomainLabel(input) {
  return parse(input, { allowPrivateDomains: false }).domainWithoutSuffix ?? null;
}

/**
 * True when the page is addressed by a literal IP (e.g. "http://192.0.2.1/")
 * instead of a domain name — something a legitimate shop essentially never
 * does.
 * @param {string} input
 * @returns {boolean}
 */
export function isIpAddress(input) {
  return parse(input, { allowPrivateDomains: false }).isIp === true;
}

/**
 * True when the URL embeds credentials before the host (the classic
 * "http://trusted.com@evil.com/" userinfo trick). Uses the URL parser's own
 * username/password fields rather than a blind "@" substring search, which
 * would false-positive on a perfectly normal "?email=a@b.com" query string.
 * @param {string} url
 * @returns {boolean}
 */
export function hasUserinfoAtSymbol(url) {
  try {
    const parsed = new URL(url);
    return parsed.username !== '' || parsed.password !== '';
  } catch {
    return false;
  }
}

/**
 * True when "https" appears in the hostname itself rather than only as the
 * real protocol — a dated but still-seen trick ("https-paypal-secure.com")
 * to make a URL look safe at a glance. Deliberately checks the hostname
 * only, not the path: a path like "/articles/https-explained" is common on
 * entirely legitimate sites and would be a noisy false positive.
 * @param {string} url
 * @returns {boolean}
 */
export function hasFakeHttpsToken(url) {
  try {
    return /https/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * True when the URL's path contains "//", which can be used to splice a
 * second URL in (open-redirect-style confusion), e.g.
 * "http://legit.com//evil.com/".
 * @param {string} url
 * @returns {boolean}
 */
export function hasRedirectionInPath(url) {
  try {
    return new URL(url).pathname.includes('//');
  } catch {
    return false;
  }
}
