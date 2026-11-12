import { fetchWithTimeout } from './http.js';
import { getCached, setCached } from './cache.js';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Looks up a SIREN/SIRET in the French government's free, no-key company
 * registry (recherche-entreprises.api.gouv.fr). Cached a week. Note: the
 * API returns a placeholder record (nom_complet: null) rather than an empty
 * result for a syntactically-valid but non-existent number, so "found" is
 * determined by a populated name, not just getting a result back.
 * @param {string} sirenOrSiret
 * @returns {Promise<{found: boolean, name: string|null, status: string|null, creationDate: string|null, address: string|null}|null>}
 */
export async function getCompanyInfo(sirenOrSiret) {
  const cacheKey = `company:${sirenOrSiret}`;
  const cached = await getCached(cacheKey, TTL_MS);
  if (cached !== undefined) return cached;

  const result = await fetchCompanyInfo(sirenOrSiret);
  // Only cache a real answer — a failed/erroring lookup must not freeze a
  // "not found" result in place for a week; it should just retry next time.
  if (result.ok) await setCached(cacheKey, result.info);
  return result.info;
}

async function fetchCompanyInfo(sirenOrSiret) {
  try {
    const res = await fetchWithTimeout(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(sirenOrSiret)}&per_page=1`);
    if (!res.ok) return { ok: false, info: null };
    const data = await res.json();
    const company = data.results?.[0];
    if (!company || company.nom_complet === null) {
      return { ok: true, info: { found: false, name: null, status: null, creationDate: null, address: null } };
    }
    return {
      ok: true,
      info: {
        found: true,
        name: company.nom_complet,
        status: company.etat_administratif, // 'A' = active, 'C' = cessée
        creationDate: company.date_creation,
        address: company.siege?.adresse ?? null,
      },
    };
  } catch {
    return { ok: false, info: null };
  }
}
