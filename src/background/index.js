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
  await pageContextByTab.set(tabId, { domain: displayId, payload });

  const { allowlist = [], customWatchedRegistrars = [] } = await browser.storage.local.get(['allowlist', 'customWatchedRegistrars']);
  const isAllowlisted = allowlist.includes(displayId);
  const watchedRegistrars = [...WATCHED_REGISTRARS, ...customWatchedRegistrars];

  const claimedText = [payload?.title, payload?.ogSiteName, payload?.jsonLdOrgName, payload?.footerCopyright]
    .filter(Boolean)
    .join(' • ');
  const matchedBrand = !isAllowlisted ? findBrandByAlias(claimedText, BRANDS_FR) : null;
  const domainLabel = domain ? (getDomainLabel(domain) ?? domain) : null;

  const signals = {
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

  // These need network calls: only pay for them when there's an actual
  // domain to look up (not a bare IP) and the page looks like a shop, or
  // already looks suspicious from free signals.
  const worthCheckingAge = !isAllowlisted && domain && (payload?.isLikelyShop || signals.matchedBrand);
  if (worthCheckingAge) {
    const legalLinks = findLegalLinks(payload?.allLinks ?? []);
    const [rdapInfo, dnssec, legalAnalysis] = await Promise.all([
      getDomainRdapInfo(domain),
      getDnssecStatus(domain),
      getLegalPageAnalysis(legalLinks[0]?.href ?? null, payload?.htmlLang ?? null),
    ]);
    signals.domainAgeDays = rdapInfo.ageDays;
    signals.registrarName = rdapInfo.registrarName;
    signals.isWatchedRegistrar = isWatchedRegistrar(rdapInfo.registrarName, watchedRegistrars);
    signals.isShortRegistrationSpan = isShortRegistrationSpan(rdapInfo.registeredAt, rdapInfo.expiresAt);
    signals.dnssec = dnssec;
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
  }

  const verdict = computeScore(signals);
  verdict.domain = displayId;
  await verdictsByTab.set(tabId, verdict);
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
  const ctx = await pageContextByTab.get(tabId);
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
