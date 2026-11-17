import { parse } from '../../vendor/tldts.min.js';

// Private suffixes (myshopify.com, wixsite.com, github.io...) count as
// public suffixes, like browsers do for cookies: "fake-shop.myshopify.com"
// is its own site, run by whoever opened that shop — not "myshopify.com",
// whose 15-year-old domain would otherwise vouch for every shop on it.
const PARSE_OPTIONS = { allowPrivateDomains: true };

/**
 * Registrable domain (eTLD+1) for a URL or hostname, e.g.
 * "www.shop.chausson.fr" -> "chausson.fr", "fake-shop.myshopify.com" ->
 * "fake-shop.myshopify.com". Returns null for IPs/localhost.
 * @param {string} input
 * @returns {string|null}
 */
export function getRegistrableDomain(input) {
  return parse(input, PARSE_OPTIONS).domain ?? null;
}

/**
 * The shared hosting platform's suffix when the site lives on one, e.g.
 * "myshopify.com" for "fake-shop.myshopify.com", else null. Such a site has
 * no domain of its own: RDAP age and DNSSEC would describe the platform.
 * @param {string} input
 * @returns {string|null}
 */
export function getSharedHostingSuffix(input) {
  const parsed = parse(input, PARSE_OPTIONS);
  return parsed.isPrivate && parsed.domain ? parsed.publicSuffix : null;
}

/**
 * Full hostname for a URL or hostname.
 * @param {string} input
 * @returns {string|null}
 */
export function getHostname(input) {
  return parse(input, PARSE_OPTIONS).hostname ?? null;
}

/**
 * The domain label without its public suffix, e.g. "chausson.fr" -> "chausson".
 * @param {string} input
 * @returns {string|null}
 */
export function getDomainLabel(input) {
  return parse(input, PARSE_OPTIONS).domainWithoutSuffix ?? null;
}

/**
 * True when the page is addressed by a literal IP (e.g. "http://192.0.2.1/")
 * instead of a domain name — something a legitimate shop essentially never
 * does.
 * @param {string} input
 * @returns {boolean}
 */
export function isIpAddress(input) {
  return parse(input, PARSE_OPTIONS).isIp === true;
}

/**
 * True for private-use, loopback and link-local IP addresses. These are
 * commonly used by local services and development servers, unlike a public
 * literal IP used as a website hostname.
 * @param {string} input URL
 * @returns {boolean}
 */
export function isPrivateIpAddress(input) {
  if (!isIpAddress(input)) return false;
  let hostname;
  try {
    hostname = new URL(input).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }

  if (!hostname.includes(':')) {
    const octets = hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
    const [a, b] = octets;
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  const words = ipv6Words(hostname);
  if (!words) return false;
  if (words.every((word) => word === 0)) return true; // unspecified (::)
  if (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) return true; // loopback (::1)
  if ((words[0] & 0xfe00) === 0xfc00) return true; // unique local (fc00::/7)
  if ((words[0] & 0xffc0) === 0xfe80) return true; // link local (fe80::/10)
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const a = words[6] >> 8;
    const b = words[6] & 0xff;
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return false;
}

/** @param {string} address @returns {number[]|null} */
function ipv6Words(address) {
  let normalized = address;
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    const octets = normalized.slice(lastColon + 1).split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${normalized.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const zeros = 8 - left.length - right.length;
  if ((halves.length === 1 && zeros !== 0) || (halves.length === 2 && zeros < 1)) return null;
  const groups = [...left, ...Array(zeros).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/i.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
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

/**
 * True when the page is served over plain HTTP. Firefox's own address bar
 * already flags this, so the weight for this signal stays modest — it's
 * meant to reinforce other signals on a page that otherwise looks like a
 * shop, not to carry the verdict on its own.
 * @param {string} url
 * @returns {boolean}
 */
export function isInsecureHttp(url) {
  try {
    return new URL(url).protocol === 'http:';
  } catch {
    return false;
  }
}
