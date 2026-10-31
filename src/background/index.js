import { getRegistrableDomain, getDomainLabel } from '../core/domain.js';
import { findBrandByAlias, isOfficialDomain, looksLikeBrandPlusGenericWord, isNearMissSpelling } from '../core/brands.js';
import { computeScore } from '../core/scoring.js';
import { BRANDS_FR } from '../data/brands-fr.js';
import { getDomainAgeDays } from './rdap.js';

/** @type {Map<number, import('../core/scoring.js').Verdict>} */
const verdictsByTab = new Map();

const BADGE_COLORS = { green: '#2e7d32', orange: '#ed6c02', red: '#c62828' };

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'FAKESHIELD_SIGNALS' && sender.tab?.id != null) {
    return handlePageSignals(sender.tab.id, sender.tab.url, message.payload);
  }
  if (message?.type === 'GET_VERDICT') {
    return Promise.resolve(verdictsByTab.get(message.tabId) ?? null);
  }
  return undefined;
});

browser.tabs.onRemoved.addListener((tabId) => verdictsByTab.delete(tabId));
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    verdictsByTab.delete(tabId);
    clearBadge(tabId);
  }
});

async function handlePageSignals(tabId, url, payload) {
  const domain = getRegistrableDomain(url);
  if (!domain) return;

  const { allowlist = [] } = await browser.storage.local.get('allowlist');
  const isAllowlisted = allowlist.includes(domain);

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

  // Domain age needs a network call: only pay for it when the page looks
  // like a shop, or when it already looks suspicious from free signals.
  const worthCheckingAge = !isAllowlisted && (payload?.isLikelyShop || signals.matchedBrand);
  if (worthCheckingAge) {
    signals.domainAgeDays = await getDomainAgeDays(domain);
  }

  const verdict = computeScore(signals);
  verdict.domain = domain;
  verdictsByTab.set(tabId, verdict);
  setBadge(tabId, verdict);

  if (verdict.band === 'red') {
    browser.tabs.sendMessage(tabId, { type: 'SHOW_BANNER', verdict }).catch(() => {});
  }
}

function setBadge(tabId, verdict) {
  browser.action.setBadgeText({ tabId, text: verdict.band === 'green' ? '' : String(verdict.score) });
  browser.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[verdict.band] });
}

function clearBadge(tabId) {
  browser.action.setBadgeText({ tabId, text: '' });
}
