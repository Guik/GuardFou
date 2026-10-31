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
