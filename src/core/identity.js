/**
 * Pure helpers behind the "fiche d'identité" (site identity card): purely
 * informational, best-effort signals — none of this feeds the score.
 */

const TECH_SIGNATURES = [
  { name: 'WordPress / WooCommerce', test: /wp-content|wp-includes/i },
  { name: 'Shopify', test: /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i },
  { name: 'PrestaShop', test: /prestashop/i },
  { name: 'Wix', test: /static\.wixstatic\.com|\bwix\.com\b/i },
  { name: 'Squarespace', test: /squarespace\.com/i },
  { name: 'Magento', test: /\/skin\/frontend\/|Mage\.Cookies|\/static\/version\d+\/frontend\//i },
  { name: 'BigCommerce', test: /cdn\d*\.bigcommerce\.com/i },
];

const SOCIAL_PLATFORMS = [
  { name: 'Facebook', domains: ['facebook.com'] },
  { name: 'Instagram', domains: ['instagram.com'] },
  { name: 'X / Twitter', domains: ['twitter.com', 'x.com'] },
  { name: 'LinkedIn', domains: ['linkedin.com'] },
  { name: 'TikTok', domains: ['tiktok.com'] },
  { name: 'YouTube', domains: ['youtube.com'] },
  { name: 'Pinterest', domains: ['pinterest.com'] },
];

/** @param {string} hostname @param {string} domain */
function hostnameMatchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

const LEGAL_LINK_TEXT = /mentions?\s*l[ée]gales?|cgv\b|cgu\b|conditions?\s*g[ée]n[ée]rales?|legal\s*notice|terms\s*(and|&)?\s*conditions|privacy\s*policy|politique\s*de\s*confidentialit[ée]|protection\s*des\s*donn[ée]es/i;

/**
 * Detected e-commerce/CMS platforms from a page's raw HTML and <meta
 * name="generator"> content, if any.
 * @param {string} html
 * @param {string|null} generatorMeta
 * @returns {string[]}
 */
export function detectTechnologies(html, generatorMeta) {
  const found = new Set();
  if (generatorMeta) found.add(generatorMeta);
  for (const sig of TECH_SIGNATURES) {
    if (sig.test.test(html)) found.add(sig.name);
  }
  return [...found];
}

/**
 * Social media links found among a page's anchor hrefs, deduplicated by
 * platform (first match kept).
 * @param {string[]} hrefs absolute URLs
 * @returns {Array<{platform: string, url: string}>}
 */
export function detectSocialLinks(hrefs) {
  const found = [];
  const seenPlatforms = new Set();
  for (const href of hrefs) {
    let hostname;
    try {
      hostname = new URL(href).hostname.toLowerCase();
    } catch {
      continue; // not an absolute URL: skip rather than guess
    }
    for (const platform of SOCIAL_PLATFORMS) {
      if (seenPlatforms.has(platform.name)) continue;
      if (platform.domains.some((domain) => hostnameMatchesDomain(hostname, domain))) {
        found.push({ platform: platform.name, url: href });
        seenPlatforms.add(platform.name);
      }
    }
  }
  return found;
}

/**
 * Filters a page's links down to the ones that look like a legal-notice /
 * terms page, by link text.
 * @param {Array<{text: string, href: string}>} links
 */
export function findLegalLinks(links) {
  return links.filter((link) => LEGAL_LINK_TEXT.test(link.text || ''));
}

/**
 * A very rough best-effort guess at a French postal address
 * ("12 rue des Lilas, 75001 Paris") in free text. Returns null when nothing
 * matching is found — this is a weak heuristic, not a validated address
 * parser.
 * @param {string} text
 */
export function extractPhysicalAddress(text) {
  const match = text.match(
    /\b\d{1,4}[a-zA-Z]?\s*(?:,|\s)\s*(?:rue|avenue|boulevard|impasse|chemin|all[ée]e|route|place|quai|cours)\s+[^\n,;]{3,60},?\s*\d{5}\s+[A-ZÀ-Ÿ][\wÀ-ÿ'\-\s]{1,30}\b/,
  );
  return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}

const STOPWORDS = {
  fr: ['le', 'la', 'les', 'de', 'des', 'et', 'un', 'une', 'est', 'dans', 'pour', 'avec', 'vous', 'nous', 'ce', 'cette', 'sont', 'par', 'sur', 'qui', 'que'],
  en: ['the', 'and', 'is', 'are', 'for', 'with', 'you', 'we', 'this', 'that', 'our', 'your', 'of', 'to', 'in', 'on', 'by'],
};

/**
 * Crude stopword-count language guess (no NLP library). Good enough to spot
 * "declared French, actually English boilerplate" — not a real language
 * detector.
 * @param {string} text
 * @returns {'fr'|'en'|'unknown'}
 */
export function guessLanguage(text) {
  const words = text.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]+/g) || [];
  if (words.length < 8) return 'unknown';
  const wordSet = new Set(words);
  const count = (list) => list.reduce((sum, w) => sum + (wordSet.has(w) ? 1 : 0), 0);
  const frScore = count(STOPWORDS.fr);
  const enScore = count(STOPWORDS.en);
  if (frScore === 0 && enScore === 0) return 'unknown';
  if (frScore >= enScore * 1.5) return 'fr';
  if (enScore >= frScore * 1.5) return 'en';
  return 'unknown';
}

/**
 * Best-effort read on a legal-notice page's text: is it there, how long,
 * and does its language match what the page declares (<html lang>)?
 * Deliberately does not attempt real spell-checking — that needs a
 * dictionary this extension doesn't ship.
 * @param {string|null} text page text, or null if no legal page was found/fetched
 * @param {string|null} declaredLang e.g. "fr" from <html lang>
 */
export function analyzeLegalText(text, declaredLang) {
  if (!text) return { present: false, length: 0, detectedLang: 'unknown', languageMismatch: false, tooShort: false };
  const trimmed = text.trim();
  const detectedLang = guessLanguage(trimmed);
  const declared = declaredLang?.slice(0, 2).toLowerCase() || null;
  const languageMismatch = Boolean(declared && detectedLang !== 'unknown' && declared !== detectedLang);
  return {
    present: true,
    length: trimmed.length,
    detectedLang,
    languageMismatch,
    tooShort: trimmed.length < 200,
  };
}

/**
 * Minimal HTML-to-text conversion (no DOMParser dependency, so it works the
 * same in a content script or a background page). Good enough for language
 * and address heuristics — not meant to preserve layout.
 * @param {string} html
 */
export function stripHtmlToText(html) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return withoutNoise
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&(?:#39|apos);/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Turns raw SEO meta booleans/counts (gathered by the content script, which
 * has the DOM) into a simple pass/fail checklist for display.
 * @param {{hasMetaDescription:boolean, hasCanonical:boolean, hasOgTitle:boolean, titleLength:number, h1Count:number, imageCount:number, imagesMissingAlt:number}} seo
 */
export function summarizeSeoMeta(seo) {
  return [
    { ok: seo.hasMetaDescription, label: 'Balise meta description présente' },
    { ok: seo.hasCanonical, label: 'Lien canonical présent' },
    { ok: seo.hasOgTitle, label: 'Balises Open Graph présentes' },
    { ok: seo.titleLength > 10 && seo.titleLength < 70, label: `Titre de page de longueur raisonnable (${seo.titleLength} caractères)` },
    { ok: seo.h1Count === 1, label: `Exactement un titre H1 (trouvé : ${seo.h1Count})` },
    {
      ok: seo.imageCount === 0 || seo.imagesMissingAlt / seo.imageCount < 0.3,
      label: `Texte alternatif sur la plupart des images (${seo.imagesMissingAlt}/${seo.imageCount} sans attribut alt)`,
    },
  ];
}
