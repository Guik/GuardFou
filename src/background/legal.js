import { fetchWithTimeout } from './http.js';
import { getCached, setCached, CACHE_TTL_MS } from './cache.js';
import { stripHtmlToText, extractContactLinks, extractPhysicalAddress, analyzeLegalText, checkMandatoryLegalMentions } from '../core/identity.js';
import { extractSirenOrSiret, isValidSirenOrSiret } from '../core/siret.js';
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
 * @returns {Promise<{
 *   address: string|null,
 *   legal: ReturnType<typeof analyzeLegalText>,
 *   mandatoryMentions: ReturnType<typeof checkMandatoryLegalMentions>,
 *   companyCheck: {
 *     candidate: {type: 'siret'|'siren', digits: string} | null,
 *     checksumValid: boolean | null,
 *     registry: Awaited<ReturnType<typeof getCompanyInfo>> | null,
 *   },
 * }>}
 */
export async function getLegalPageAnalysis(legalUrls, declaredLang) {
  const urls = legalUrls.filter(Boolean);
  if (urls.length === 0) return emptyAnalysis(declaredLang);

  const textAnalysis = await getLegalTextAnalysis(urls, declaredLang);
  if (!textAnalysis) return emptyAnalysis(declaredLang);

  const { address, legal, mandatoryMentions, companyNumber: { candidate, checksumValid } } = textAnalysis;
  // Only look up a number whose checksum passes — no point wasting a
  // registry request on an obviously fabricated one.
  const registry = candidate && checksumValid ? await getCompanyInfo(candidate.digits) : null;
  return { address, legal, mandatoryMentions, companyCheck: { candidate, checksumValid, registry } };
}

/**
 * Everything derived from the pages' text, or null when none of them had
 * any. Cached per set of URLs (and declared language, which the language
 * check depends on), only when every page was actually fetched — a page
 * that timed out must not freeze an incomplete result in place for a week.
 * @param {string[]} urls
 * @param {string|null} declaredLang
 */
async function getLegalTextAnalysis(urls, declaredLang) {
  const cacheKey = `legal:${declaredLang ?? ''}:${urls.join(' ')}`;
  const cached = await getCached(cacheKey, CACHE_TTL_MS);
  if (cached !== undefined) return cached;

  const pages = await Promise.all(urls.map(fetchPageText));
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
    companyNumber: { candidate, checksumValid: candidate ? isValidSirenOrSiret(candidate) : null },
  };
}

async function fetchPageText(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { ok: false, text: '' };
    const html = await res.text();
    // Append mailto:/tel: href targets so contact info shown only as a
    // "Nous contacter" link (not spelled out in visible text) still counts.
    const text = `${stripHtmlToText(html)} ${extractContactLinks(html)}`.trim();
    return { ok: true, text };
  } catch {
    return { ok: false, text: '' };
  }
}

function emptyAnalysis(declaredLang) {
  return {
    address: null,
    legal: analyzeLegalText(null, declaredLang),
    mandatoryMentions: null,
    companyCheck: { candidate: null, checksumValid: null, registry: null },
  };
}
