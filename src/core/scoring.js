/**
 * @typedef {{ id: string, weight: number, message: string }} Reason
 * @typedef {{ score: number, band: 'green'|'orange'|'red', reasons: Reason[] }} Verdict
 */

export const THRESHOLDS = { orange: 30, red: 60 };

/**
 * Turn a flat `signals` object into a score + list of human-readable reasons.
 * Pure function: no network, no browser APIs, easy to unit test.
 *
 * Recognised signals (all optional):
 *  - domainAgeDays: number | null
 *  - claimedBrandName: string | null   (the brand name the page claims to be)
 *  - matchedBrand: { name, officialDomains } | null (from core/brands.js)
 *  - isOfficialDomain: boolean
 *  - looksLikeBrandPlusGenericWord: boolean
 *  - isNearMissSpelling: boolean
 *  - isAllowlisted: boolean
 *
 * @param {Record<string, any>} signals
 * @returns {Verdict}
 */
export function computeScore(signals) {
  if (signals.isAllowlisted) {
    return { score: 0, band: 'green', reasons: [{ id: 'allowlisted', weight: 0, message: 'Site ajouté à votre liste de confiance.' }] };
  }

  /** @type {Reason[]} */
  const reasons = [];

  if (typeof signals.domainAgeDays === 'number') {
    if (signals.domainAgeDays < 30 * 6) {
      reasons.push({ id: 'domain-very-new', weight: 35, message: `Le nom de domaine a été créé il y a seulement ${signals.domainAgeDays} jours.` });
    } else if (signals.domainAgeDays < 365) {
      reasons.push({ id: 'domain-new', weight: 20, message: `Le nom de domaine a moins d'un an (${Math.round(signals.domainAgeDays / 30)} mois).` });
    } else if (signals.domainAgeDays > 365 * 5) {
      reasons.push({ id: 'domain-old', weight: -15, message: 'Le nom de domaine existe depuis plus de 5 ans.' });
    }
  }

  if (signals.matchedBrand && !signals.isOfficialDomain) {
    reasons.push({
      id: 'brand-domain-mismatch',
      weight: 40,
      message: `Le site se présente comme « ${signals.matchedBrand.name} » mais son domaine n'est pas ${signals.matchedBrand.officialDomains.join(' ni ')}.`,
    });
  } else if (signals.looksLikeBrandPlusGenericWord || signals.isNearMissSpelling) {
    reasons.push({
      id: 'brand-lookalike-domain',
      weight: 15,
      message: 'Le nom de domaine ressemble à celui d\'une marque connue, avec un mot ajouté ou une orthographe proche.',
    });
  }

  const rawScore = reasons.reduce((sum, r) => sum + r.weight, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const band = score >= THRESHOLDS.red ? 'red' : score >= THRESHOLDS.orange ? 'orange' : 'green';

  reasons.sort((a, b) => b.weight - a.weight);
  return { score, band, reasons };
}
