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
 *  - isIpHostname: boolean (page addressed by a literal IP, not a domain)
 *  - hasUserinfoAtSymbol: boolean ("http://trusted.com@evil.com/" trick)
 *  - hasFakeHttpsToken: boolean ("https" embedded in the hostname itself)
 *  - hasRedirectionInPath: boolean ("//" inside the URL path)
 *  - isShortRegistrationSpan: boolean (domain registered for ~1 year only)
 *  - isInsecureHttp: boolean (page served over plain HTTP, not HTTPS)
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

  if (signals.isIpHostname) {
    reasons.push({
      id: 'ip-hostname',
      weight: 45,
      message: "Le site est accédé via une adresse IP directe plutôt qu'un nom de domaine, ce qui est extrêmement rare pour un site légitime.",
    });
  }

  if (signals.hasUserinfoAtSymbol) {
    reasons.push({
      id: 'userinfo-at-symbol',
      weight: 30,
      message: "L'adresse contient un « @ » avant le nom de domaine, une technique utilisée pour maquiller une fausse adresse en vraie.",
    });
  }

  if (signals.hasFakeHttpsToken) {
    reasons.push({
      id: 'fake-https-token',
      weight: 10,
      message: 'Le mot « https » apparaît dans le nom de domaine lui-même, une technique pour paraître plus sûr qu\'il ne l\'est.',
    });
  }

  if (signals.hasRedirectionInPath) {
    reasons.push({
      id: 'redirection-in-path',
      weight: 10,
      message: "L'adresse contient un « // » dans son chemin, ce qui peut servir à dissimuler une redirection vers un autre site.",
    });
  }

  // Firefox's own address bar already flags plain HTTP, so this stays a
  // small nudge — it reinforces other signals rather than carrying the
  // verdict on its own.
  if (signals.isInsecureHttp) {
    reasons.push({
      id: 'insecure-http',
      weight: 10,
      message: "Le site n'utilise pas HTTPS : la connexion n'est pas chiffrée.",
    });
  }

  if (typeof signals.domainAgeDays === 'number') {
    if (signals.domainAgeDays < 30 * 6) {
      reasons.push({ id: 'domain-very-new', weight: 35, message: `Le nom de domaine a été créé il y a seulement ${signals.domainAgeDays} jours.` });
    } else if (signals.domainAgeDays < 365) {
      reasons.push({ id: 'domain-new', weight: 20, message: `Le nom de domaine a moins d'un an (${Math.round(signals.domainAgeDays / 30)} mois).` });
    } else if (signals.domainAgeDays > 365 * 5) {
      reasons.push({ id: 'domain-old', weight: -15, message: 'Le nom de domaine existe depuis plus de 5 ans.' });
    }
  }

  // Registering for only ~1 year proves nothing by itself — plenty of real
  // sites just renew annually for years. Only meaningful paired with a
  // domain that's also brand new: a long-term business usually secures its
  // domain for several years up front.
  if (signals.isShortRegistrationSpan && typeof signals.domainAgeDays === 'number' && signals.domainAgeDays < 30 * 6) {
    reasons.push({
      id: 'short-registration-span',
      weight: 10,
      message: "Le domaine n'a été enregistré que pour environ un an, l'engagement minimal, plutôt que plusieurs années à l'avance.",
    });
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
