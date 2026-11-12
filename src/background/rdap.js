import { fetchWithTimeout } from './http.js';
import { getCached, setCached, CACHE_TTL_MS } from './cache.js';
import { extractDomainAgeDays, extractRegistrarName, extractDomainDates } from '../core/rdap.js';

export const EMPTY_RDAP_INFO = { ageDays: null, registrarName: null, registeredAt: null, lastChangedAt: null, expiresAt: null };

/**
 * Registration age, registrar name and key dates for a domain, via the RDAP
 * bootstrap service (free, no key). All from the same lookup, cached a week.
 * @param {string} domain registrable domain, e.g. "chaussonconstruction.com"
 * @returns {Promise<{ageDays: number|null, registrarName: string|null, registeredAt: string|null, lastChangedAt: string|null, expiresAt: string|null}>}
 */
export async function getDomainRdapInfo(domain) {
  const cacheKey = `rdap:${domain}`;
  const cached = await getCached(cacheKey, CACHE_TTL_MS);
  if (cached !== undefined) return cached;

  const result = await fetchDomainRdapInfo(domain);
  // Only cache a real answer — a failed/erroring lookup must not freeze a
  // "no data" result in place for a week; it should just retry next time.
  if (result.ok) await setCached(cacheKey, result.info);
  return result.info;
}

async function fetchDomainRdapInfo(domain) {
  try {
    const res = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json' },
    });
    if (!res.ok) return { ok: false, info: EMPTY_RDAP_INFO };
    const data = await res.json();
    return {
      ok: true,
      info: {
        ageDays: extractDomainAgeDays(data),
        registrarName: extractRegistrarName(data),
        ...extractDomainDates(data),
      },
    };
  } catch {
    return { ok: false, info: EMPTY_RDAP_INFO };
  }
}
