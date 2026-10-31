/**
 * Registrars to flag as a weak secondary signal, only combined with a
 * recently-created domain (see core/scoring.js). This list is deliberately
 * short and conservative: most of these registrars are large, legitimate
 * wholesale/reseller registrars used by thousands of real businesses, so
 * being registered there is not evidence of fraud on its own — it only
 * nudges the score when paired with other red flags. Extend it from the
 * options page as you confirm more cases yourself, rather than trusting an
 * unverified public "bad registrar" list.
 */
export const WATCHED_REGISTRARS = [
  'realtime register', // confirmed on a Chausson-impersonating clone, Oct 2026
];
