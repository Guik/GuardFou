// Who hosts a site and which other sites share its server — shown in the
// identity card, never scored: a shared server says nothing about a site
// on its own, but a small server shared with a handful of look-alike shops
// is worth seeing.

// https://www.cloudflare.com/ips-v4 (stable; checked 2026-11). An address
// in these ranges is Cloudflare's proxy, not the site's real server.
const CLOUDFLARE_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
];

// Hosting platforms and CDNs, recognized from the IP's owner in RDAP:
// thousands of unrelated sites share each of their addresses.
const PLATFORMS = [
  ['Cloudflare', /cloudflare/i], ['Vercel', /vercel|zeit/i], ['Shopify', /shopify/i], ['Amazon', /amazon|\baws\b/i],
  ['Google', /google/i], ['Microsoft', /microsoft|azure/i], ['Fastly', /fastly/i], ['Akamai', /akamai/i],
  ['Netlify', /netlify/i], ['Wix', /\bwix\b/i], ['Squarespace', /squarespace/i], ['GitHub', /github/i],
];

// Above this many other sites, the server is shared hosting and the list is noise.
export const MAX_LISTED_NEIGHBORS = 20;

function ipv4ToNumber(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return parts.reduce((n, p) => n * 256 + p, 0);
}

/** @param {string} ip */
export function isCloudflareIp(ip) {
  const n = ipv4ToNumber(ip);
  if (n === null) return false;
  return CLOUDFLARE_V4.some((cidr) => {
    const [base, bits] = cidr.split('/');
    const size = 2 ** (32 - Number(bits));
    const start = ipv4ToNumber(base);
    return n >= start && n < start + size;
  });
}

/**
 * The organisation an IP block belongs to, from an RDAP answer: the
 * registrant when it's an organisation, else the network's name ("OVH").
 * People listed as contacts are never used.
 * @param {any} rdap
 * @returns {{ owner: string|null, country: string|null }}
 */
export function interpretIpRdap(rdap) {
  let owner = null;
  for (const entity of rdap?.entities ?? []) {
    if (!entity.roles?.includes('registrant')) continue;
    const fields = entity.vcardArray?.[1] ?? [];
    const kind = fields.find((f) => f[0] === 'kind')?.[3];
    const fn = fields.find((f) => f[0] === 'fn')?.[3];
    if (kind === 'org' && fn) owner = fn;
  }
  return { owner: owner ?? rdap?.name ?? null, country: rdap?.country ?? null };
}

/** @param {string|null} owner */
export function platformFromOwner(owner) {
  if (!owner) return null;
  return PLATFORMS.find(([, test]) => test.test(owner))?.[0] ?? null;
}

/**
 * Hostnames from HackerTarget's reverse IP lookup (one per line), or null
 * when it answered with an error or a quota message instead.
 * @param {string} text
 */
export function parseReverseIpResponse(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null; // nothing came back: the lookup failed
  if (lines.length === 1 && /^no\b.*\brecords? found/i.test(lines[0])) return [];
  if (lines.some((l) => !/^[a-z0-9.-]+$/i.test(l))) return null;
  return lines;
}

/**
 * The other sites on the server, one per registrable domain, without the
 * site's own.
 * @param {string[]} hostnames
 * @param {string} ownDomain registrable domain of the site
 * @param {(host: string) => string|null} registrableDomain
 */
export function neighborDomains(hostnames, ownDomain, registrableDomain) {
  const domains = new Set();
  for (const host of hostnames) {
    const domain = registrableDomain(host);
    if (domain && domain !== ownDomain) domains.add(domain);
  }
  return [...domains].sort();
}
