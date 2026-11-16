import { fetchWithTimeout } from './http.js';
import { getCached, setCached, CACHE_TTL_MS } from './cache.js';

/**
 * Records cached before the fields after `address` existed lack them.
 * @typedef {{
 *   found: boolean, name: string|null, status: string|null, creationDate: string|null, address: string|null,
 *   siren?: string, legalFormCode?: string|null, nafCode?: string|null, nafSection?: string|null,
 *   employeesCode?: string|null, country?: string|null, closureDate?: string|null,
 *   tradeNames?: string[], directors?: { name: string, role: string|null }[],
 * }} CompanyInfo
 */

/**
 * Looks up a SIREN/SIRET in the French government's free, no-key company
 * registry (recherche-entreprises.api.gouv.fr). Cached a week. Note: the
 * API returns a placeholder record (nom_complet: null) rather than an empty
 * result for a syntactically-valid but non-existent number, so "found" is
 * determined by a populated name, not just getting a result back.
 * @param {string} sirenOrSiret
 * @returns {Promise<CompanyInfo|null>}
 */
export async function getCompanyInfo(sirenOrSiret) {
  // "company2": records cached under "company" lack the fields added since
  // (legal form, activity, directors...); a new key fetches them at once.
  const cacheKey = `company2:${sirenOrSiret}`;
  const cached = await getCached(cacheKey, CACHE_TTL_MS);
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
        siren: company.siren,
        legalFormCode: company.nature_juridique ?? null,
        nafCode: company.activite_principale ?? null,
        nafSection: company.section_activite_principale ?? null,
        employeesCode: company.tranche_effectif_salarie ?? null,
        // Only set for a head office abroad, in French and upper case ("ESPAGNE").
        country: company.siege?.libelle_pays_etranger ?? null,
        closureDate: company.date_fermeture ?? null,
        tradeNames: [...new Set([company.siege?.nom_commercial, ...(company.siege?.liste_enseignes ?? [])].filter(Boolean))],
        directors: (company.dirigeants ?? []).slice(0, 3).map((d) => ({
          name: d.denomination ?? [d.prenoms, d.nom].filter(Boolean).join(' '),
          role: d.qualite ?? null,
        })),
      },
    };
  } catch {
    return { ok: false, info: null };
  }
}
