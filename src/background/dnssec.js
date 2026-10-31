import { getCached, setCached } from './cache.js';
import { interpretDnssecResponse } from '../core/dnssec.js';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * DNSSEC status for a domain, via Cloudflare's DNS-over-HTTPS JSON API (free,
 * no key). Cached for a week. Returns null when the lookup fails.
 * @param {string} domain
 * @returns {Promise<{signed:boolean, validated:boolean, bogus:boolean}|null>}
 */
export async function getDnssecStatus(domain) {
  const cacheKey = `dnssec:${domain}`;
  const cached = await getCached(cacheKey, TTL_MS);
  if (cached !== undefined) return cached;

  const status = await fetchDnssecStatus(domain);
  await setCached(cacheKey, status);
  return status;
}

async function fetchDnssecStatus(domain) {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=DNSKEY&do=true`,
      { headers: { Accept: 'application/dns-json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return interpretDnssecResponse(data);
  } catch {
    return null;
  }
}
