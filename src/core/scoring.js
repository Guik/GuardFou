/**
 * @typedef {{ id: string, weight: number, message: string }} Reason
 * @typedef {{ score: number, band: 'green'|'orange'|'red', reasons: Reason[] }} Verdict
 */

import { t, formatList } from './i18n.js';

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
 *  - lookalikeBrand: { name, officialDomains } | null (the brand whose
 *    domain this one imitates, from core/brands.js's findLookalikeBrand)
 *  - isAllowlisted: boolean
 *  - dnssec: { signed: boolean, validated: boolean, bogus: boolean } | null
 *  - registrarName: string | null
 *  - isWatchedRegistrar: boolean (registrarName matched your watched-registrars list)
 *  - isIpHostname: boolean (page addressed by a literal IP, not a domain)
 *  - sharedHostingSuffix: string | null (e.g. "myshopify.com" when the site
 *    is a subdomain of a shared hosting platform, so has no domain age)
 *  - hasUserinfoAtSymbol: boolean ("http://trusted.com@evil.com/" trick)
 *  - hasFakeHttpsToken: boolean ("https" embedded in the hostname itself)
 *  - hasRedirectionInPath: boolean ("//" inside the URL path)
 *  - isShortRegistrationSpan: boolean (domain registered for ~1 year only)
 *  - isInsecureHttp: boolean (page served over plain HTTP, not HTTPS)
 *  - legalPageMissing: boolean (no mentions-légales page found at all)
 *  - legalMentions: { universal, conditional } | null — field objects
 *    carry their own { key, weight, present }
 *    (from core/identity.js's checkMandatoryLegalMentions, only when a
 *    legal page was found — mutually exclusive with legalPageMissing)
 *  - siretInvalidChecksum: boolean (a SIRET/SIREN was found but fails Luhn)
 *  - siretNotFound: boolean (checksum-valid SIRET/SIREN absent from the
 *    official French company registry)
 *  - companyClosed: boolean (the registered company is cessée/closed)
 *  - companyNameMismatch: boolean (registered name doesn't match the
 *    brand/name the page claims to be — a real SIRET reused for a
 *    different business)
 *  - registeredCompanyName: string | null (for the mismatch message)
 *
 * @param {Record<string, any>} signals
 * @returns {Verdict}
 */
export function computeScore(signals) {
  if (signals.isAllowlisted) {
    return { score: 0, band: 'green', reasons: [{ id: 'allowlisted', weight: 0, message: t('reasonAllowlisted') }] };
  }

  /** @type {Reason[]} */
  const reasons = [];

  if (signals.isIpHostname) {
    reasons.push({
      id: 'ip-hostname',
      weight: 45,
      message: t('reasonIpHostname'),
    });
  }

  if (signals.hasUserinfoAtSymbol) {
    reasons.push({
      id: 'userinfo-at-symbol',
      weight: 30,
      message: t('reasonUserinfoAtSymbol'),
    });
  }

  if (signals.hasFakeHttpsToken) {
    reasons.push({
      id: 'fake-https-token',
      weight: 10,
      message: t('reasonFakeHttpsToken'),
    });
  }

  if (signals.hasRedirectionInPath) {
    reasons.push({
      id: 'redirection-in-path',
      weight: 10,
      message: t('reasonRedirectionInPath'),
    });
  }

  // Firefox's own address bar already flags plain HTTP, so this stays a
  // small nudge — it reinforces other signals rather than carrying the
  // verdict on its own.
  if (signals.isInsecureHttp) {
    reasons.push({
      id: 'insecure-http',
      weight: 10,
      message: t('reasonInsecureHttp'),
    });
  }

  // Not a fraud signal by itself — plenty of real small shops live on
  // Shopify/Wix subdomains — but it explains why the domain-age and DNSSEC
  // checks are missing from the verdict, which would otherwise look
  // suspiciously clean.
  if (signals.sharedHostingSuffix) {
    reasons.push({
      id: 'shared-hosting',
      weight: 0,
      message: t('reasonSharedHosting', signals.sharedHostingSuffix),
    });
  }

  if (typeof signals.domainAgeDays === 'number') {
    if (signals.domainAgeDays < 30 * 6) {
      reasons.push({ id: 'domain-very-new', weight: 35, message: t('reasonDomainVeryNew', signals.domainAgeDays) });
    } else if (signals.domainAgeDays < 365) {
      reasons.push({ id: 'domain-new', weight: 20, message: t('reasonDomainNew', Math.round(signals.domainAgeDays / 30)) });
    } else if (signals.domainAgeDays > 365 * 5) {
      reasons.push({ id: 'domain-old', weight: -15, message: t('reasonDomainOld') });
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
      message: t('reasonShortRegistrationSpan'),
    });
  }

  // A watched registrar alone proves nothing — they're mostly large,
  // legitimate wholesale registrars. Only nudge the score when it's paired
  // with a recently-created domain, where it reinforces that signal.
  if (signals.isWatchedRegistrar && typeof signals.domainAgeDays === 'number' && signals.domainAgeDays < 365 * 2) {
    reasons.push({
      id: 'watched-registrar-recent-domain',
      weight: 8,
      message: t('reasonWatchedRegistrar', signals.registrarName),
    });
  }

  if (signals.dnssec?.bogus) {
    reasons.push({
      id: 'dnssec-bogus',
      weight: 20,
      message: t('reasonDnssecBogus'),
    });
  } else if (signals.dnssec?.validated) {
    // Most legitimate shops don't sign their zone either, so the absence of
    // DNSSEC is deliberately not penalised — only a known-bad signature is.
    reasons.push({ id: 'dnssec-ok', weight: -5, message: t('reasonDnssecOk') });
  }

  if (signals.legalPageMissing) {
    reasons.push({
      id: 'legal-page-missing',
      weight: 15,
      message: t('reasonLegalPageMissing'),
    });
  } else if (signals.legalMentions) {
    const { universal = [], conditional = [] } = signals.legalMentions;
    // Each field carries its own weight now (SIRET/adresse/dénomination
    // matter more than e.g. hébergeur/contact — see core/identity.js),
    // rather than a flat per-tier multiplier, so the score — and the
    // preview below — naturally reflect how important what's missing
    // actually is, sorted most-severe first.
    const missing = [...universal, ...conditional].filter((m) => !m.present).sort((a, b) => b.weight - a.weight);
    const weight = missing.reduce((sum, m) => sum + m.weight, 0);
    if (weight > 0) {
      const total = missing.length;
      // Labels are looked up by key rather than carried on the field: the
      // legal analysis is cached for a week, and the reason must follow the
      // browser's current language.
      const shown = missing.slice(0, 3).map((m) => t(`legalField_${m.key}`));
      const more = total - shown.length;
      if (more > 0) shown.push(more === 1 ? t('legalMoreOne') : t('legalMoreOther', more));
      const list = formatList(shown, 'unit');
      reasons.push({
        id: 'incomplete-legal-mentions',
        weight,
        message: total === 1 ? t('reasonIncompleteLegalMentionsOne', list) : t('reasonIncompleteLegalMentionsOther', total, list),
      });
    }
  }

  // SIRET/SIREN cross-referenced against the official French company
  // registry (recherche-entreprises.api.gouv.fr). A checksum failure is
  // weighted lighter since it could just be a typo; the registry-backed
  // checks are near-direct evidence.
  if (signals.siretInvalidChecksum) {
    reasons.push({
      id: 'siret-invalid-checksum',
      weight: 15,
      message: t('reasonSiretInvalidChecksum'),
    });
  } else if (signals.siretNotFound) {
    reasons.push({
      id: 'siret-not-found',
      weight: 25,
      message: t('reasonSiretNotFound'),
    });
  } else if (signals.companyClosed) {
    reasons.push({
      id: 'company-closed',
      weight: 30,
      message: t('reasonCompanyClosed', signals.registeredCompanyName),
    });
  } else if (signals.companyNameMismatch) {
    reasons.push({
      id: 'company-name-mismatch',
      weight: 20,
      message: t('reasonCompanyNameMismatch', signals.registeredCompanyName),
    });
  }

  if (signals.matchedBrand && !signals.isOfficialDomain) {
    reasons.push({
      id: 'brand-domain-mismatch',
      weight: 40,
      message: t('reasonBrandDomainMismatch', signals.matchedBrand.name, formatList(signals.matchedBrand.officialDomains, 'disjunction')),
    });
  } else if (signals.lookalikeBrand) {
    reasons.push({
      id: 'brand-lookalike-domain',
      weight: 15,
      message: t('reasonBrandLookalikeDomain', signals.lookalikeBrand.name, formatList(signals.lookalikeBrand.officialDomains, 'unit')),
    });
  }

  const rawScore = reasons.reduce((sum, r) => sum + r.weight, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const band = score >= THRESHOLDS.red ? 'red' : score >= THRESHOLDS.orange ? 'orange' : 'green';

  reasons.sort((a, b) => b.weight - a.weight);
  return { score, band, reasons };
}
