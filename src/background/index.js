import { getRegistrableDomain, getDomainLabel } from '../core/domain.js';
import { findBrandByAlias, isOfficialDomain, looksLikeBrandPlusGenericWord, isNearMissSpelling } from '../core/brands.js';
import { isWatchedRegistrar } from '../core/registrar.js';
import { computeScore } from '../core/scoring.js';
import { detectTechnologies, detectSocialLinks, findLegalLinks, summarizeSeoMeta } from '../core/identity.js';
import { BRANDS_FR } from '../data/brands-fr.js';
import { WATCHED_REGISTRARS } from '../data/watched-registrars.js';
import { getDomainRdapInfo } from './rdap.js';
import { getDnssecStatus } from './dnssec.js';
import { getLegalPageAnalysis } from './legal.js';

/** @type {Map<number, import('../core/scoring.js').Verdict>} */
const verdictsByTab = new Map();

/** @type {Map<number, {domain: string, payload: Record<string, any>}>} */
const pageContextByTab = new Map();

const BADGE_COLORS = { green: '#2e7d32', orange: '#ed6c02', red: '#c62828' };

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'FAKESHIELD_SIGNALS' && sender.tab?.id != null) {
    return handlePageSignals(sender.tab.id, sender.tab.url, message.payload);
  }
  if (message?.type === 'GET_VERDICT') {
    return Promise.resolve(verdictsByTab.get(message.tabId) ?? null);
  }
  if (message?.type === 'GET_IDENTITY_CARD') {
    return buildIdentityCard(message.tabId);
  }
  return undefined;
});

browser.tabs.onRemoved.addListener((tabId) => {
  verdictsByTab.delete(tabId);
  pageContextByTab.delete(tabId);
});
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    verdictsByTab.delete(tabId);
    pageContextByTab.delete(tabId);
    clearBadge(tabId);
  }
});

async function handlePageSignals(tabId, url, payload) {
  const domain = getRegistrableDomain(url);
  if (!domain) return;

  pageContextByTab.set(tabId, { domain, payload });

  const { allowlist = [], customWatchedRegistrars = [] } = await browser.storage.local.get(['allowlist', 'customWatchedRegistrars']);
  const isAllowlisted = allowlist.includes(domain);
  const watchedRegistrars = [...WATCHED_REGISTRARS, ...customWatchedRegistrars];

  const claimedText = [payload?.title, payload?.ogSiteName, payload?.jsonLdOrgName, payload?.footerCopyright]
    .filter(Boolean)
    .join(' • ');
  const matchedBrand = !isAllowlisted ? findBrandByAlias(claimedText, BRANDS_FR) : null;
  const domainLabel = getDomainLabel(domain) ?? domain;

  const signals = {
    isAllowlisted,
    matchedBrand,
    isOfficialDomain: matchedBrand ? isOfficialDomain(domain, matchedBrand) : false,
    looksLikeBrandPlusGenericWord: matchedBrand ? looksLikeBrandPlusGenericWord(domainLabel, matchedBrand) : false,
    isNearMissSpelling: matchedBrand ? isNearMissSpelling(domainLabel, matchedBrand) : false,
  };

  // These need network calls: only pay for them when the page looks like a
  // shop, or when it already looks suspicious from free signals.
  const worthCheckingAge = !isAllowlisted && (payload?.isLikelyShop || signals.matchedBrand);
  if (worthCheckingAge) {
    const [rdapInfo, dnssec] = await Promise.all([
      getDomainRdapInfo(domain),
      getDnssecStatus(domain),
    ]);
    signals.domainAgeDays = rdapInfo.ageDays;
    signals.registrarName = rdapInfo.registrarName;
    signals.isWatchedRegistrar = isWatchedRegistrar(rdapInfo.registrarName, watchedRegistrars);
    signals.dnssec = dnssec;
  }

  const verdict = computeScore(signals);
  verdict.domain = domain;
  verdictsByTab.set(tabId, verdict);
  setBadge(tabId, verdict);

  if (verdict.band === 'red') {
    browser.tabs.sendMessage(tabId, { type: 'SHOW_BANNER', verdict }).catch(() => {});
  }
}

/**
 * Builds the "fiche d'identité" for a tab: purely informational, on-demand
 * (only fetched when the popup's identity panel is opened), reusing
 * whatever RDAP/legal-page data is already cached.
 */
async function buildIdentityCard(tabId) {
  const ctx = pageContextByTab.get(tabId);
  if (!ctx) return null;
  const { domain, payload } = ctx;

  const allLinks = payload?.allLinks ?? [];
  const legalLinks = findLegalLinks(allLinks);

  const [rdapInfo, legalAnalysis] = await Promise.all([
    getDomainRdapInfo(domain),
    getLegalPageAnalysis(legalLinks[0]?.href ?? null, payload?.htmlLang ?? null),
  ]);

  return {
    domain,
    registrationDate: rdapInfo.registeredAt,
    lastChangedDate: rdapInfo.lastChangedAt,
    expirationDate: rdapInfo.expiresAt,
    registrarName: rdapInfo.registrarName,
    technologies: detectTechnologies(payload?.techHints ?? '', payload?.generatorMeta ?? null),
    socialLinks: detectSocialLinks(allLinks.map((l) => l.href)),
    seoMetaSummary: payload?.seoMeta ? summarizeSeoMeta(payload.seoMeta) : [],
    address: legalAnalysis.address,
    legalText: legalAnalysis.legal,
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
