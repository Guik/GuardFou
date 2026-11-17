import { fetchWithTimeout, logIfSlow } from './http.js';
import { getCached, setCached, CACHE_TTL_MS } from './cache.js';
import { stripHtmlToText, extractContactLinks, extractPhysicalAddress, analyzeLegalText, checkMandatoryLegalMentions } from '../core/identity.js';
import { extractSirenOrSiret, isValidSirenOrSiret, extractPublisherStatements } from '../core/siret.js';
import { getCompanyInfo } from './companyRegistry.js';

/**
 * Fetches and analyzes a site's legal-notice page(s) — mentions légales,
 * CGV, privacy policy — best-effort, and combines their text before
 * checking. Real sites routinely split this information across separate
 * documents (mentions légales for company identity/hébergeur, CGV for
 * commercial terms including TVA/médiateur), so checking only one
 * systematically under-reports completeness even for a fully compliant
 * site — confirmed on adepem.com, which has both.
 *
 * What gets cached is the analysis of that set of pages, not their text:
 * a few hundred bytes per site instead of the full text of every legal
 * page ever visited. The registry lookup stays outside it, with its own
 * cache, so a failed lookup is retried rather than frozen in here.
 * @param {string[]} legalUrls absolute URLs of the legal/terms page(s), already deduplicated/capped by the caller
 * @param {string|null} declaredLang e.g. "fr" from the shop page's <html lang>
 * @param {{ viaPage?: (url: string) => Promise<{ok: boolean, html: string} | null> }} [options]
 *   viaPage reads a page through the tab's content script, for sites whose
 *   bot protection blocks the background's own request
 * @returns {Promise<{
 *   address: string|null,
 *   unreadable: boolean,
 *   legal: ReturnType<typeof analyzeLegalText>,
 *   mandatoryMentions: ReturnType<typeof checkMandatoryLegalMentions>,
 *   publisherText: string,
 *   companyCheck: {
 *     candidate: {type: 'siret'|'siren', digits: string} | null,
 *     checksumValid: boolean | null,
 *     registry: Awaited<ReturnType<typeof getCompanyInfo>> | null,
 *   },
 * }>}
 */
export async function getLegalPageAnalysis(legalUrls, declaredLang, { viaPage } = {}) {
  const urls = legalUrls.filter(Boolean);
  if (urls.length === 0) return emptyAnalysis(declaredLang);

  const textAnalysis = await getLegalTextAnalysis(urls, declaredLang, viaPage);
  // Links to legal pages were found but none could be fetched (blocked by
  // bot protection such as Cloudflare, timed out, server error): that says
  // nothing about the site, unlike having no legal page at all.
  if (textAnalysis === UNREADABLE) return { ...emptyAnalysis(declaredLang), unreadable: true };
  if (!textAnalysis) return emptyAnalysis(declaredLang);

  // publisherText is missing from analyses cached before it existed.
  const { address, legal, mandatoryMentions, publisherText = '', companyNumber: { candidate, checksumValid } } = textAnalysis;
  // Only look up a number whose checksum passes — no point wasting a
  // registry request on an obviously fabricated one.
  const registry = candidate && checksumValid ? await getCompanyInfo(candidate.digits) : null;
  return { address, unreadable: false, legal, mandatoryMentions, publisherText, companyCheck: { candidate, checksumValid, registry } };
}

const UNREADABLE = Symbol('unreadable');

// 2: publisher statements also read "propriété de", "publié par"… and the
// words before a SIRET/SIREN/RCS. 3: the host's SIRET is skipped.
const LEGAL_ANALYSIS_VERSION = 3;

// A site that blocked us is asked again after a day, not on every page view:
// retrying each time is exactly what gets a visitor's IP flagged as a bot.
const BLOCKED_TTL_MS = 24 * 60 * 60 * 1000;
// The same, in memory only: honoured even when the cache is turned off in
// the settings, and forgotten when the browser restarts.
const blockedSince = new Map();

/**
 * Everything derived from the pages' text, null when the pages loaded but
 * had no text, or UNREADABLE when none of them could be loaded. When they
 * were blocked rather than down, that is remembered for BLOCKED_TTL_MS. Cached per set of URLs (and declared language, which the language
 * check depends on), only when every page was actually fetched — a page
 * that timed out must not freeze an incomplete result in place for a week.
 * @param {string[]} urls
 * @param {string|null} declaredLang
 */
async function getLegalTextAnalysis(urls, declaredLang, viaPage) {
  // Bump LEGAL_ANALYSIS_VERSION when analyzeText changes, so week-old
  // analyses made by the previous code are ignored instead of served.
  const cacheKey = `legal:v${LEGAL_ANALYSIS_VERSION}:${declaredLang ?? ''}:${urls.join(' ')}`;
  if (Date.now() - (blockedSince.get(cacheKey) ?? -Infinity) < BLOCKED_TTL_MS) return UNREADABLE;
  const cached = await getCached(cacheKey, CACHE_TTL_MS);
  if (cached?.blocked) {
    if ((await getCached(cacheKey, BLOCKED_TTL_MS)) !== undefined) return UNREADABLE;
  } else if (cached !== undefined) {
    return cached;
  }

  const pages = await Promise.all(urls.map((url) => fetchPageText(url, viaPage)));
  if (pages.every((page) => !page.ok)) {
    if (pages.some((page) => page.blocked)) {
      blockedSince.set(cacheKey, Date.now());
      await setCached(cacheKey, { blocked: true });
    }
    return UNREADABLE;
  }
  const combinedText = pages.map((page) => page.text).filter(Boolean).join(' ').trim();
  const analysis = combinedText ? analyzeText(combinedText, declaredLang) : null;
  if (pages.every((page) => page.ok)) await setCached(cacheKey, analysis);
  return analysis;
}

function analyzeText(text, declaredLang) {
  const candidate = extractSirenOrSiret(text);
  return {
    address: extractPhysicalAddress(text),
    legal: analyzeLegalText(text, declaredLang),
    mandatoryMentions: checkMandatoryLegalMentions(text),
    publisherText: extractPublisherStatements(text),
    companyNumber: { candidate, checksumValid: candidate ? isValidSirenOrSiret(candidate) : null },
  };
}

/**
 * One page's text. `blocked` means bot protection refused the request (as
 * opposed to a timeout or a server error); the page is then read through
 * the tab instead, when viaPage is given.
 * @returns {Promise<{ ok: boolean, blocked: boolean, text: string }>}
 */
async function fetchPageText(url, viaPage) {
  const direct = await fetchHtml(url);
  if (direct.ok) return { ok: true, blocked: false, text: pageText(direct.html) };
  if (!direct.blocked || !viaPage) return { ok: false, blocked: direct.blocked, text: '' };
  const started = Date.now();
  const fromPage = await viaPage(url).catch(() => null);
  logIfSlow(url, started, `read through the tab: ${fromPage?.ok ? 'ok' : 'failed'}`, !fromPage?.ok);
  if (fromPage?.ok && !isBotChallenge(fromPage.html)) return { ok: true, blocked: false, text: pageText(fromPage.html) };
  return { ok: false, blocked: true, text: '' };
}

// Statuses bot protection answers with; 503 only counts with a challenge page.
const BLOCKED_STATUSES = new Set([403, 429]);

async function fetchHtml(url) {
  try {
    const res = await fetchWithTimeout(url);
    const html = await res.text();
    if (isBotChallenge(html) || BLOCKED_STATUSES.has(res.status)) return { ok: false, blocked: true, html: '' };
    return { ok: res.ok, blocked: false, html: res.ok ? html : '' };
  } catch {
    return { ok: false, blocked: false, html: '' };
  }
}

// Append mailto:/tel: href targets so contact info shown only as a
// "Nous contacter" link (not spelled out in visible text) still counts.
function pageText(html) {
  return `${stripHtmlToText(html)} ${extractContactLinks(html)}`.trim();
}

// A bot-protection page served with a 200 status instead of the real page:
// its text would read as a legal page with every mandatory mention missing.
const BOT_CHALLENGE_TITLE = /<title>\s*(Just a moment|Attention Required|Un instant|DDoS-Guard|Access denied)/i;
function isBotChallenge(html) {
  return BOT_CHALLENGE_TITLE.test(html.slice(0, 5000));
}

function emptyAnalysis(declaredLang) {
  return {
    address: null,
    unreadable: false,
    legal: analyzeLegalText(null, declaredLang),
    mandatoryMentions: null,
    publisherText: '',
    companyCheck: { candidate: null, checksumValid: null, registry: null },
  };
}
