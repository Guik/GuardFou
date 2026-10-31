import { getCached, setCached } from './cache.js';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Domain registration age in days, via the RDAP bootstrap service. Cached
 * for a week. Returns null when the lookup fails or no registration date
 * is published (never a guess — the scoring treats null as "unknown").
 * @param {string} domain registrable domain, e.g. "chaussonconstruction.com"
 * @returns {Promise<number|null>}
 */
export async function getDomainAgeDays(domain) {
  const cacheKey = `rdap:${domain}`;
  const cached = await getCached(cacheKey, TTL_MS);
  if (cached !== undefined) return cached;

  const ageDays = await fetchDomainAgeDays(domain);
  await setCached(cacheKey, ageDays);
  return ageDays;
}

async function fetchDomainAgeDays(domain) {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const registrationEvent = (data.events || []).find((e) => e.eventAction === 'registration');
    if (!registrationEvent) return null;
    const registeredAt = new Date(registrationEvent.eventDate).getTime();
    if (Number.isNaN(registeredAt)) return null;
    return Math.max(0, Math.round((Date.now() - registeredAt) / 86400000));
  } catch {
    return null;
  }
}
