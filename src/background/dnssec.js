import { fetchWithTimeout } from './http.js';
import { getCached, setCached, CACHE_TTL_MS } from './cache.js';
import { interpretDnssecResponse } from '../core/dnssec.js';

/**
 * DNSSEC status for a domain, via Cloudflare's DNS-over-HTTPS JSON API (free,
 * no key). Cached for a week. Returns null when the lookup fails.
 * @param {string} domain
 * @returns {Promise<{signed:boolean, validated:boolean, bogus:boolean}|null>}
 */
export async function getDnssecStatus(domain) {
  const cacheKey = `dnssec:${domain}`;
  const cached = await getCached(cacheKey, CACHE_TTL_MS);
  if (cached !== undefined) return cached;

  const result = await fetchDnssecStatus(domain);
  // Only cache a real answer — a failed/erroring lookup must not freeze a
  // "no data" result in place for a week; it should just retry next time.
  if (result.ok) await setCached(cacheKey, result.status);
  return result.status;
}

async function fetchDnssecStatus(domain) {
  try {
    const data = await queryDnskey(domain, false);
    // SERVFAIL alone doesn't say why — a broken or unreachable nameserver
    // fails the same way as a bad signature. Asking again with validation
    // disabled tells them apart: only a DNSSEC failure answers fine then.
    const unchecked = data.Status === 2 ? await queryDnskey(domain, true) : null;
    return { ok: true, status: interpretDnssecResponse(data, unchecked) };
  } catch {
    return { ok: false, status: null };
  }
}

/** @param {string} domain @param {boolean} checkingDisabled DoH `cd` flag */
async function queryDnskey(domain, checkingDisabled) {
  const cd = checkingDisabled ? '&cd=true' : '';
  const res = await fetchWithTimeout(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=DNSKEY&do=true${cd}`,
    { headers: { Accept: 'application/dns-json' } },
  );
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  return res.json();
}
