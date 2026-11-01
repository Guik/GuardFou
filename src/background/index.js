import {
  getRegistrableDomain,
  getDomainLabel,
  getHostname,
  isIpAddress,
  hasUserinfoAtSymbol,
  hasFakeHttpsToken,
  hasRedirectionInPath,
  isInsecureHttp,
} from '../core/domain.js';
import { findBrandByAlias, isOfficialDomain, looksLikeBrandPlusGenericWord, isNearMissSpelling } from '../core/brands.js';
import { isWatchedRegistrar } from '../core/registrar.js';
import { companyNameMatchesClaim } from '../core/siret.js';
import { computeScore } from '../core/scoring.js';
import { detectTechnologies, detectSocialLinks, findLegalLinks, summarizeSeoMeta } from '../core/identity.js';
import { isShortRegistrationSpan } from '../core/rdap.js';
import { BRANDS_FR } from '../data/brands-fr.js';
import { WATCHED_REGISTRARS } from '../data/watched-registrars.js';
import { getDomainRdapInfo } from './rdap.js';
import { getDnssecStatus } from './dnssec.js';
import { getLegalPageAnalysis } from './legal.js';

// Firefox can unload this background script after a few minutes of
// inactivity (it's an event page, not a persistent one). A plain in-memory
// Map would lose every tab's verdict and scraped page data the moment that
// happens, even though the toolbar badge — which the browser manages
// natively per tab — keeps showing the old result. browser.storage.session
// is backed by the browser itself rather than this script's lifetime, so it
// survives that restart; it's still cleared when the browser session ends.
const verdictsByTab = sessionTabStore('fakeshield:verdict:');
const pageContextByTab = sessionTabStore('fakeshield:pagecontext:');

function sessionTabStore(prefix) {
  return {
    async get(tabId) {
      const key = prefix + tabId;
      const stored = await browser.storage.session.get(key);
      return stored[key] ?? null;
    },
    async set(tabId, value) {
      await browser.storage.session.set({ [prefix + tabId]: value });
    },
    async delete(tabId) {
      await browser.storage.session.remove(prefix + tabId);
    },
  };
}

const BADGE_COLORS = { green: '#2e7d32', orange: '#ed6c02', red: '#c62828' };

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'FAKESHIELD_SIGNALS' && sender.tab?.id != null) {
    return handlePageSignals(sender.tab.id, sender.tab.url, message.payload);
  }
  if (message?.type === 'GET_VERDICT') {
    return verdictsByTab.get(message.tabId);
  }
  if (message?.type === 'GET_IDENTITY_CARD') {
    return buildIdentityCard(message.tabId);
  }
  return undefined;
});

browser.tabs.onRemoved.addListener((tabId) => {
  verdictsByTab.delete(tabId).catch(() => {});
  pageContextByTab.delete(tabId).catch(() => {});
});
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    verdictsByTab.delete(tabId).catch(() => {});
    pageContextByTab.delete(tabId).catch(() => {});
    clearBadge(tabId);
  }
});

async function handlePageSignals(tabId, url, payload) {
  const domain = getRegistrableDomain(url);
  const isIpHostname = isIpAddress(url);
  // A bare IP has no registrable domain but is still very much worth
  // analyzing (it's one of the strongest signals we have) — only bail out
  // when there's truly nothing to key off, e.g. about:/file: pages.
  if (!domain && !isIpHostname) return;

  const displayId = domain ?? getHostname(url) ?? url;

  const { allowlist = [], customWatchedRegistrars = [] } = await browser.storage.local.get(['allowlist', 'customWatchedRegistrars']);
  const isAllowlisted = allowlist.includes(displayId);
  const watchedRegistrars = [...WATCHED_REGISTRARS, ...customWatchedRegistrars];

  const claimedText = [payload?.title, payload?.ogSiteName, payload?.jsonLdOrgName, payload?.footerCopyright]
    .filter(Boolean)
    .join(' • ');
  const matchedBrand = !isAllowlisted ? findBrandByAlias(claimedText, BRANDS_FR) : null;
  const domainLabel = domain ? (getDomainLabel(domain) ?? domain) : null;

  const baseSignals = {
    isAllowlisted,
    matchedBrand,
    isOfficialDomain: matchedBrand && domain ? isOfficialDomain(domain, matchedBrand) : false,
    looksLikeBrandPlusGenericWord: matchedBrand && domainLabel ? looksLikeBrandPlusGenericWord(domainLabel, matchedBrand) : false,
    isNearMissSpelling: matchedBrand && domainLabel ? isNearMissSpelling(domainLabel, matchedBrand) : false,
    // Cheap, synchronous, URL-structural checks — always computed, no network.
    isIpHostname,
    hasUserinfoAtSymbol: hasUserinfoAtSymbol(url),
    hasFakeHttpsToken: hasFakeHttpsToken(url),
    hasRedirectionInPath: hasRedirectionInPath(url),
    isInsecureHttp: isInsecureHttp(url),
  };

  // Stashed so buildIdentityCard can later run the same network-dependent
  // checks (RDAP/DNSSEC/legal+SIRET) without redoing brand-matching, and so
  // it can fold the result back into the real score — see there for why.
  await pageContextByTab.set(tabId, { domain, displayId, payload, baseSignals, claimedText, watchedRegistrars, isAllowlisted });

  // The network-dependent checks (RDAP, DNSSEC, legal page, SIRET registry)
  // only run automatically when the page looks like a shop or matches a
  // known brand, to avoid firing them on every random page you browse.
  // Pages that don't meet that bar (a non-commerce site, an association...)
  // simply won't get those checks until you explicitly open the identity
  // card — see buildIdentityCard, which runs them unconditionally and
  // updates the stored verdict so the headline score stays consistent with
  // whatever the card ends up showing.
  const worthCheckingAge = !isAllowlisted && domain && (payload?.isLikelyShop || matchedBrand);
  const signals = worthCheckingAge
    ? { ...baseSignals, ...(await computeNetworkSignals(domain, payload, watchedRegistrars, claimedText)).signals }
    : baseSignals;

  await publishVerdict(tabId, displayId, signals);
}

/**
 * Runs every network-dependent check (RDAP age/registrar/dates, DNSSEC,
 * legal-page fetch + mandatory-mentions + SIRET registry cross-check) and
 * turns the results into both scoring signals and the raw data the identity
 * card displays. Each underlying fetch has its own cache, so calling this
 * twice for the same domain/legal page (once from the automatic pass, once
 * from the identity card) is cheap after the first real fetch.
 */
async function computeNetworkSignals(domain, payload, watchedRegistrars, claimedText) {
  const legalLinks = findLegalLinks(payload?.allLinks ?? [], domain);
  const legalUrl = legalLinks[0]?.href ?? null;
  const [rdapInfo, dnssec, legalAnalysis] = await Promise.all([
    getDomainRdapInfo(domain),
    getDnssecStatus(domain),
    getLegalPageAnalysis(legalUrl, payload?.htmlLang ?? null),
  ]);

  const signals = {
    domainAgeDays: rdapInfo.ageDays,
    registrarName: rdapInfo.registrarName,
    isWatchedRegistrar: isWatchedRegistrar(rdapInfo.registrarName, watchedRegistrars),
    isShortRegistrationSpan: isShortRegistrationSpan(rdapInfo.registeredAt, rdapInfo.expiresAt),
    dnssec,
  };

  if (legalAnalysis.legal.present) {
    signals.legalMentions = legalAnalysis.mandatoryMentions;
  } else {
    signals.legalPageMissing = true;
  }

  const { candidate, checksumValid, registry } = legalAnalysis.companyCheck;
  if (candidate) {
    if (checksumValid === false) {
      signals.siretInvalidChecksum = true;
    } else if (registry && !registry.found) {
      signals.siretNotFound = true;
    } else if (registry?.status === 'C') {
      signals.companyClosed = true;
      signals.registeredCompanyName = registry.name;
    } else if (registry?.found && !companyNameMatchesClaim(registry.name, claimedText)) {
      signals.companyNameMismatch = true;
      signals.registeredCompanyName = registry.name;
    }
  }

  return { signals, rdapInfo, legalAnalysis, legalUrl };
}

async function publishVerdict(tabId, displayId, signals) {
  const verdict = computeScore(signals);
  verdict.domain = displayId;
  await verdictsByTab.set(tabId, verdict);
  setBadge(tabId, verdict);

  if (verdict.band === 'red') {
    browser.tabs.sendMessage(tabId, { type: 'SHOW_BANNER', verdict }).catch(() => {});
  }
  return verdict;
}

/**
 * Builds the "fiche d'identité" for a tab, on-demand (only when the popup's
 * identity panel is opened). Unlike the automatic pass in handlePageSignals,
 * this always runs the full network-dependent checks regardless of whether
 * the page looked like a shop — you asked for a deep look, so it also
 * recomputes and republishes the real verdict/badge from those results,
 * rather than leaving the headline score stuck at whatever the lighter
 * automatic pass decided was "worth checking".
 */
async function buildIdentityCard(tabId) {
  const ctx = await pageContextByTab.get(tabId);
  if (!ctx) return null;
  const { domain, displayId, payload, baseSignals, claimedText, watchedRegistrars, isAllowlisted } = ctx;

  const allLinks = payload?.allLinks ?? [];

  let rdapInfo = { ageDays: null, registrarName: null, registeredAt: null, lastChangedAt: null, expiresAt: null };
  let legalAnalysis = { address: null, legal: { present: false, length: 0, detectedLang: 'unknown', languageMismatch: false, tooShort: false }, mandatoryMentions: null, companyCheck: { candidate: null, checksumValid: null, registry: null } };
  let legalUrl = null;

  if (!isAllowlisted && domain) {
    const network = await computeNetworkSignals(domain, payload, watchedRegistrars, claimedText);
    rdapInfo = network.rdapInfo;
    legalAnalysis = network.legalAnalysis;
    legalUrl = network.legalUrl;
    await publishVerdict(tabId, displayId, { ...baseSignals, ...network.signals });
  }

  return {
    domain: displayId,
    registrationDate: rdapInfo.registeredAt,
    lastChangedDate: rdapInfo.lastChangedAt,
    expirationDate: rdapInfo.expiresAt,
    registrarName: rdapInfo.registrarName,
    technologies: detectTechnologies(payload?.techHints ?? '', payload?.generatorMeta ?? null),
    socialLinks: detectSocialLinks(allLinks.map((l) => l.href)),
    seoMetaSummary: payload?.seoMeta ? summarizeSeoMeta(payload.seoMeta) : [],
    address: legalAnalysis.address,
    legalText: legalAnalysis.legal,
    legalUrl,
    mandatoryMentions: legalAnalysis.mandatoryMentions,
    companyCheck: legalAnalysis.companyCheck,
    // Not available without a paid/keyed API (SimilarWeb, Ahrefs, Moz...) — deferred.
    popularity: null,
    referringLinks: null,
  };
}

function setBadge(tabId, verdict) {
  browser.action.setBadgeText({ tabId, text: verdict.band === 'green' ? '' : String(verdict.score) });
  browser.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[verdict.band] });
}

function clearBadge(tabId) {
  browser.action.setBadgeText({ tabId, text: '' });
}
