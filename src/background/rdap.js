import { getCached, setCached } from './cache.js';
import { extractDomainAgeDays, extractRegistrarName } from '../core/rdap.js';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Registration age and registrar name for a domain, via the RDAP bootstrap
 * service (free, no key). Both come from the same lookup, cached a week.
 * @param {string} domain registrable domain, e.g. "chaussonconstruction.com"
 * @returns {Promise<{ageDays: number|null, registrarName: string|null}>}
 */
export async function getDomainRdapInfo(domain) {
  const cacheKey = `rdap:${domain}`;
  const cached = await getCached(cacheKey, TTL_MS);
  if (cached !== undefined) return cached;

  const info = await fetchDomainRdapInfo(domain);
  await setCached(cacheKey, info);
  return info;
}

async function fetchDomainRdapInfo(domain) {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json' },
    });
    if (!res.ok) return { ageDays: null, registrarName: null };
    const data = await res.json();
    return { ageDays: extractDomainAgeDays(data), registrarName: extractRegistrarName(data) };
  } catch {
    return { ageDays: null, registrarName: null };
  }
}
