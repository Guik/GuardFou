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
 *  - dnssec: { signed: boolean, validated: boolean, bogus: boolean } | null
 *  - registrarName: string | null
 *  - isWatchedRegistrar: boolean (registrarName matched your watched-registrars list)
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

  // A watched registrar alone proves nothing — they're mostly large,
  // legitimate wholesale registrars. Only nudge the score when it's paired
  // with a recently-created domain, where it reinforces that signal.
  if (signals.isWatchedRegistrar && typeof signals.domainAgeDays === 'number' && signals.domainAgeDays < 365 * 2) {
    reasons.push({
      id: 'watched-registrar-recent-domain',
      weight: 8,
      message: `Domaine récent enregistré via ${signals.registrarName}, un bureau d'enregistrement déjà vu sur des boutiques éphémères.`,
    });
  }

  if (signals.dnssec?.bogus) {
    reasons.push({
      id: 'dnssec-bogus',
      weight: 20,
      message: 'La validation DNSSEC du domaine échoue (signature invalide) : signe possible de détournement ou de usurpation DNS.',
    });
  } else if (signals.dnssec?.validated) {
    // Most legitimate shops don't sign their zone either, so the absence of
    // DNSSEC is deliberately not penalised — only a known-bad signature is.
    reasons.push({ id: 'dnssec-ok', weight: -5, message: 'Le domaine est protégé par DNSSEC et la signature est valide.' });
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
