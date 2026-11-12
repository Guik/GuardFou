import {
  getRegistrableDomain,
  getDomainLabel,
  getHostname,
  getSharedHostingSuffix,
  isIpAddress,
  hasUserinfoAtSymbol,
  hasFakeHttpsToken,
  hasRedirectionInPath,
  isInsecureHttp,
} from '../core/domain.js';
import { findBrandByAlias, getBrandClaimText, isOfficialDomain, findLookalikeBrand } from '../core/brands.js';
import { isWatchedRegistrar } from '../core/registrar.js';
import { companyNameMatchesClaim } from '../core/siret.js';
import { computeScore } from '../core/scoring.js';
import { t, i18nReady } from '../core/i18n.js';
import { detectTechnologies, detectSocialLinks, findLegalLinks, pageLooksLikeOwnLegalDocument, summarizeSeoMeta } from '../core/identity.js';
import { isShortRegistrationSpan } from '../core/rdap.js';
import { BRANDS_FR } from '../data/brands-fr.js';
import { WATCHED_REGISTRARS } from '../data/watched-registrars.js';
import { getDomainRdapInfo, EMPTY_RDAP_INFO } from './rdap.js';
import { getDnssecStatus } from './dnssec.js';
import { getLegalPageAnalysis } from './legal.js';
import { pruneExpiredCache } from './cache.js';

// Firefox can unload this background script after a few minutes of
// inactivity (it's an event page, not a persistent one). A plain in-memory
// Map would lose every tab's verdict the moment that happens, even though the toolbar badge — which the browser manages
// natively per tab — keeps showing the old result. browser.storage.session
// is backed by the browser itself rather than this script's lifetime, so it
// survives that restart; it's still cleared when the browser session ends.
const verdictsByTab = sessionTabStore('guardfou:verdict:');

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

// Which page load each tab's in-flight analysis belongs to. The network
// checks take seconds; if the tab navigates in the meantime, the old page's
// result must not land on the new one (wrong score and domain in the popup,
// or a red banner injected into an unrelated page). In-memory is enough: if
// Firefox unloads this script, the in-flight work it guards dies with it.
const currentPageByTab = new Map();

pruneExpiredCache().catch(() => {});

const BADGE_COLORS = { green: '#2e7d32', orange: '#ed6c02', red: '#c62828' };

browser.runtime.onMessage.addListener((message, sender) => {
  // Reasons and labels are written in the chosen language, so wait for it.
  if (message?.type === 'GUARDFOU_SIGNALS' && sender.tab?.id != null) {
    return i18nReady.then(() => handlePageSignals(sender.tab.id, sender.tab.url, message.payload));
  }
  if (message?.type === 'GET_VERDICT') {
    return verdictsByTab.get(message.tabId);
  }
  if (message?.type === 'GET_IDENTITY_CARD') {
    return i18nReady.then(() => buildIdentityCard(message.tabId));
  }
  return undefined;
});

browser.tabs.onRemoved.addListener((tabId) => {
  currentPageByTab.delete(tabId);
  verdictsByTab.delete(tabId).catch(() => {});
});
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    currentPageByTab.delete(tabId);
    verdictsByTab.delete(tabId).catch(() => {});
    clearBadge(tabId);
  }
});

// A bare IP has no registrable domain but is still very much worth
// analyzing (it's one of the strongest signals we have) — only skip pages
// with truly nothing to key off, e.g. about:/file: pages.
function isAnalyzable(url) {
  return Boolean(getRegistrableDomain(url)) || isIpAddress(url);
}

// Marks a new analysis as the tab's current one, and returns a check that
// stays true only until the tab navigates or another analysis starts.
function startPageAnalysis(tabId) {
  const page = {};
  currentPageByTab.set(tabId, page);
  return () => currentPageByTab.get(tabId) === page;
}

/**
 * Everything both passes need that doesn't require the network: the
 * allowlist and watched registrars, the brand the page claims, and the
 * cheap URL-structural signals.
 */
async function analyzePage(url, payload) {
  const domain = getRegistrableDomain(url);
  const displayId = domain ?? getHostname(url) ?? url;

  const { allowlist = [], customWatchedRegistrars = [], checkAgeOnEverySite = false } = await browser.storage.local.get(['allowlist', 'customWatchedRegistrars', 'checkAgeOnEverySite']);
  const isAllowlisted = allowlist.includes(displayId);
  const watchedRegistrars = [...WATCHED_REGISTRARS, ...customWatchedRegistrars];

  const claimedText = [payload?.title, payload?.ogSiteName, payload?.jsonLdOrgName, payload?.footerCopyright]
    .filter(Boolean)
    .join(' • ');
  const matchedBrand = !isAllowlisted ? findBrandByAlias(getBrandClaimText(payload), BRANDS_FR) : null;
  const domainLabel = domain ? (getDomainLabel(domain) ?? domain) : null;

  const baseSignals = {
    isAllowlisted,
    matchedBrand,
    isOfficialDomain: matchedBrand && domain ? isOfficialDomain(domain, matchedBrand) : false,
    lookalikeBrand: !isAllowlisted && domain && domainLabel ? findLookalikeBrand(domain, domainLabel, BRANDS_FR) : null,
    // Cheap, synchronous, URL-structural checks — always computed, no network.
    isIpHostname: isIpAddress(url),
    sharedHostingSuffix: domain ? getSharedHostingSuffix(domain) : null,
    hasUserinfoAtSymbol: hasUserinfoAtSymbol(url),
    hasFakeHttpsToken: hasFakeHttpsToken(url),
    hasRedirectionInPath: hasRedirectionInPath(url),
    isInsecureHttp: isInsecureHttp(url),
  };

  return { domain, displayId, isAllowlisted, watchedRegistrars, checkAgeOnEverySite, claimedText, matchedBrand, baseSignals };
}

async function handlePageSignals(tabId, url, payload) {
  if (!isAnalyzable(url)) return;
  const isCurrentPage = startPageAnalysis(tabId);
  const { domain, displayId, isAllowlisted, watchedRegistrars, checkAgeOnEverySite, claimedText, matchedBrand, baseSignals } = await analyzePage(url, payload);

  // The network-dependent checks (RDAP, DNSSEC, legal pages, SIRET registry)
  // only run automatically when the page looks like a shop or claims a
  // known brand; other pages get them when you open the identity card — see
  // buildIdentityCard, which runs them unconditionally and updates the
  // stored verdict so the headline score stays consistent with whatever the
  // card ends up showing. Domain age alone can be turned on for every site
  // in the settings: it's a single cached lookup per domain, but a young
  // domain is orange on its own, which is noisy on blogs and new projects
  // that sell nothing, and it sends every visited domain to rdap.org.
  const signals = { ...baseSignals };
  if (!isAllowlisted && domain) {
    const wantsDeepChecks = payload?.isLikelyShop || matchedBrand;
    const [registration, deep] = await Promise.all([
      wantsDeepChecks || checkAgeOnEverySite ? computeRegistrationSignals(domain, watchedRegistrars) : null,
      wantsDeepChecks ? computeDeepSignals(domain, payload, claimedText, url) : null,
    ]);
    Object.assign(signals, registration?.signals, deep?.signals);
  }

  if (!isCurrentPage()) return;
  await publishVerdict(tabId, displayId, signals);
}

/**
 * Domain age, registrar and registration span, from RDAP. Cached per domain,
 * so it's one lookup per site rather than per page.
 */
async function computeRegistrationSignals(domain, watchedRegistrars) {
  // A subdomain of a shared hosting platform has no registration of its
  // own: RDAP would only describe the platform's domain.
  const rdapInfo = getSharedHostingSuffix(domain) !== null ? EMPTY_RDAP_INFO : await getDomainRdapInfo(domain);
  return {
    signals: {
      domainAgeDays: rdapInfo.ageDays,
      registrarName: rdapInfo.registrarName,
      isWatchedRegistrar: isWatchedRegistrar(rdapInfo.registrarName, watchedRegistrars),
      isShortRegistrationSpan: isShortRegistrationSpan(rdapInfo.registeredAt, rdapInfo.expiresAt),
    },
    rdapInfo,
  };
}

/**
 * Runs the heavier network-dependent checks (DNSSEC, legal-page fetch +
 * mandatory-mentions + SIRET registry cross-check) and turns the results
 * into both scoring signals and the raw data the identity card displays.
 * Each underlying fetch has its own cache, so calling this twice for the
 * same domain/legal pages (once from the automatic pass, once from the
 * identity card) is cheap after the first real fetch.
 * @param {string} [currentUrl] the tab's own URL — used as a fallback legal
 *   page when no link on the page points to one (many sites don't
 *   hyperlink the nav item for the page you're already on, so visiting a
 *   legal page directly would otherwise find nothing to check)
 */
async function computeDeepSignals(domain, payload, claimedText, currentUrl) {
  const legalLinks = findLegalLinks(payload?.allLinks ?? [], domain);
  // Real sites routinely split legal info across separate documents
  // (mentions légales for company identity, CGV for commercial terms
  // including TVA/médiateur) — checking only the top-priority one
  // under-reports completeness even for a fully compliant site. Capped at
  // 3 (and deduplicated) so a page with many legal-ish links doesn't
  // trigger a pile of fetches.
  //
  // The page you're actually on goes first, whenever it qualifies as a
  // legal document itself — not just as a last resort when no links were
  // found. Two pages on the same site can have differently-templated
  // footers (one linking to both mentions légales and CGV, another only
  // to itself), so without this, being directly on a legal page could give
  // *less* coverage than being elsewhere on the site, which is backwards.
  const candidateUrls = [];
  if (currentUrl && pageLooksLikeOwnLegalDocument(payload?.title, currentUrl)) candidateUrls.push(currentUrl);
  candidateUrls.push(...legalLinks.map((l) => l.href));
  const legalUrls = [...new Set(candidateUrls)].slice(0, 3);
  // A subdomain of a shared hosting platform has no DNS zone of its own:
  // DNSSEC would only describe the platform's domain.
  const onSharedHosting = getSharedHostingSuffix(domain) !== null;
  const [dnssec, legalAnalysis] = await Promise.all([
    onSharedHosting ? null : getDnssecStatus(domain),
    getLegalPageAnalysis(legalUrls, payload?.htmlLang ?? null),
  ]);

  const signals = { dnssec };

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

  return { signals, legalAnalysis, legalUrls };
}

async function publishVerdict(tabId, displayId, signals) {
  const verdict = computeScore(signals);
  verdict.domain = displayId;
  await verdictsByTab.set(tabId, verdict);
  setBadge(tabId, verdict);

  if (verdict.band === 'red') {
    // The content script can't load the chosen language itself, so the
    // banner's text travels with the verdict.
    const text = { title: t('bannerTitle', verdict.score), details: t('bannerDetails'), dismiss: t('bannerDismiss') };
    browser.tabs.sendMessage(tabId, { type: 'SHOW_BANNER', verdict, text }).catch(() => {});
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
  // Reuse the automatic pass's token if it's still alive, so a navigation
  // that already started a new analysis invalidates this one too.
  const page = currentPageByTab.get(tabId) ?? {};
  currentPageByTab.set(tabId, page);
  const isCurrentPage = () => currentPageByTab.get(tabId) === page;

  const { url } = await browser.tabs.get(tabId);
  if (!isAnalyzable(url)) return null;
  // The page is read again rather than kept from when it loaded: nothing
  // but the verdict is stored per tab, and the card reflects the page as it
  // is now (prices or links rendered late, a shop that changes page without
  // reloading). The content script isn't there in a tab opened before the
  // extension was installed or updated; reloading the page brings it back.
  const payload = await browser.tabs.sendMessage(tabId, { type: 'GUARDFOU_COLLECT' }).catch(() => null);
  if (!payload) return { needsReload: true };
  if (!isCurrentPage()) return null;

  const { domain, displayId, isAllowlisted, watchedRegistrars, claimedText, baseSignals } = await analyzePage(url, payload);

  let rdapInfo = EMPTY_RDAP_INFO;
  let legalAnalysis = { address: null, legal: { present: false, length: 0, detectedLang: 'unknown', languageMismatch: false, tooShort: false }, mandatoryMentions: null, companyCheck: { candidate: null, checksumValid: null, registry: null } };
  let legalUrls = [];

  if (!isAllowlisted && domain) {
    const [registration, deep] = await Promise.all([
      computeRegistrationSignals(domain, watchedRegistrars),
      computeDeepSignals(domain, payload, claimedText, url),
    ]);
    if (!isCurrentPage()) return null; // navigated away meanwhile
    rdapInfo = registration.rdapInfo;
    legalAnalysis = deep.legalAnalysis;
    legalUrls = deep.legalUrls;
    await publishVerdict(tabId, displayId, { ...baseSignals, ...registration.signals, ...deep.signals });
  }

  return {
    domain: displayId,
    registrationDate: rdapInfo.registeredAt,
    lastChangedDate: rdapInfo.lastChangedAt,
    expirationDate: rdapInfo.expiresAt,
    registrarName: rdapInfo.registrarName,
    technologies: detectTechnologies(payload.techHints ?? '', payload.generatorMeta ?? null),
    socialLinks: detectSocialLinks((payload.allLinks ?? []).map((l) => l.href)),
    seoMetaSummary: payload.seoMeta ? summarizeSeoMeta(payload.seoMeta) : [],
    address: legalAnalysis.address,
    legalText: legalAnalysis.legal,
    legalUrls,
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
