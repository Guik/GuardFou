import { getCached, setCached } from './cache.js';
import { stripHtmlToText, extractContactLinks, extractPhysicalAddress, analyzeLegalText, checkMandatoryLegalMentions } from '../core/identity.js';
import { extractSirenOrSiret, isValidSirenOrSiret } from '../core/siret.js';
import { getCompanyInfo } from './companyRegistry.js';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fetches and analyzes a legal-notice page (mentions légales / CGV...),
 * best-effort. Cached a week since legal pages rarely change. Returns a
 * "not found" shape when there's no legal link at all, without a network
 * call.
 * @param {string|null} legalUrl absolute URL of the legal/terms page
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
export async function getLegalPageAnalysis(legalUrl, declaredLang) {
  if (!legalUrl) return emptyAnalysis(declaredLang);

  const cacheKey = `legal:${legalUrl}`;
  const cached = await getCached(cacheKey, TTL_MS);
  if (cached !== undefined) return cached;

  const result = await fetchAndAnalyze(legalUrl, declaredLang);
  // Only cache a real answer — a failed/erroring fetch must not freeze a
  // "no data" result in place for a week; it should just retry next time.
  if (result.ok) await setCached(cacheKey, result.analysis);
  return result.analysis;
}

async function fetchAndAnalyze(legalUrl, declaredLang) {
  try {
    const res = await fetch(legalUrl);
    if (!res.ok) return { ok: false, analysis: emptyAnalysis(declaredLang) };
    const html = await res.text();
    // Append mailto:/tel: href targets so contact info shown only as a
    // "Nous contacter" link (not spelled out in visible text) still counts.
    const text = `${stripHtmlToText(html)} ${extractContactLinks(html)}`.trim();
    return {
      ok: true,
      analysis: {
        address: extractPhysicalAddress(text),
        legal: analyzeLegalText(text, declaredLang),
        mandatoryMentions: checkMandatoryLegalMentions(text),
        companyCheck: await checkCompanyRegistry(text),
      },
    };
  } catch {
    return { ok: false, analysis: emptyAnalysis(declaredLang) };
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
