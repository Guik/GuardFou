import { fetchWithTimeout } from './http.js';
import { getCached, setCached } from './cache.js';
import { stripHtmlToText, extractContactLinks, extractPhysicalAddress, analyzeLegalText, checkMandatoryLegalMentions } from '../core/identity.js';
import { extractSirenOrSiret, isValidSirenOrSiret } from '../core/siret.js';
import { getCompanyInfo } from './companyRegistry.js';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fetches and analyzes a site's legal-notice page(s) — mentions légales,
 * CGV, privacy policy — best-effort, and combines their text before
 * checking. Real sites routinely split this information across separate
 * documents (mentions légales for company identity/hébergeur, CGV for
 * commercial terms including TVA/médiateur), so checking only one
 * systematically under-reports completeness even for a fully compliant
 * site — confirmed on adepem.com, which has both.
 *
 * Each page is fetched and cached individually by its own URL, so adding
 * or dropping a URL from the list doesn't invalidate what's already
 * cached for the others.
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

  const texts = await Promise.all(urls.map(getLegalPageText));
  const combinedText = texts.filter(Boolean).join(' ').trim();
  if (!combinedText) return emptyAnalysis(declaredLang);

  return {
    address: extractPhysicalAddress(combinedText),
    legal: analyzeLegalText(combinedText, declaredLang),
    mandatoryMentions: checkMandatoryLegalMentions(combinedText),
    companyCheck: await checkCompanyRegistry(combinedText),
  };
}

/**
 * A single page's text (+ mailto:/tel: contact targets appended), or ''
 * on any failure. Cached per URL.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function getLegalPageText(url) {
  const cacheKey = `legalpage:${url}`;
  const cached = await getCached(cacheKey, TTL_MS);
  if (cached !== undefined) return cached;

  const result = await fetchPageText(url);
  // Only cache a real answer — a failed/erroring fetch must not freeze an
  // empty result in place for a week; it should just retry next time.
  if (result.ok) await setCached(cacheKey, result.text);
  return result.text;
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

/**
 * Extracts a SIREN/SIRET from the legal text, validates its checksum, and —
 * only if the checksum actually passes, so we don't waste a lookup on an
 * obviously fabricated number — cross-references it against the French
 * government's company registry.
 */
async function checkCompanyRegistry(text) {
  const candidate = extractSirenOrSiret(text);
  if (!candidate) return { candidate: null, checksumValid: null, registry: null };

  const checksumValid = isValidSirenOrSiret(candidate);
  if (!checksumValid) return { candidate, checksumValid, registry: null };

  const registry = await getCompanyInfo(candidate.digits);
  return { candidate, checksumValid, registry };
}

function emptyAnalysis(declaredLang) {
  return {
    address: null,
    legal: analyzeLegalText(null, declaredLang),
    mandatoryMentions: null,
    companyCheck: { candidate: null, checksumValid: null, registry: null },
  };
}
