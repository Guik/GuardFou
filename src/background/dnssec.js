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

  const result = await fetchDnssecStatus(domain);
  // Only cache a real answer — a failed/erroring lookup must not freeze a
  // "no data" result in place for a week; it should just retry next time.
  if (result.ok) await setCached(cacheKey, result.status);
  return result.status;
}

async function fetchDnssecStatus(domain) {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=DNSKEY&do=true`,
      { headers: { Accept: 'application/dns-json' } },
    );
    if (!res.ok) return { ok: false, status: null };
    const data = await res.json();
    return { ok: true, status: interpretDnssecResponse(data) };
  } catch {
    return { ok: false, status: null };
  }
}
