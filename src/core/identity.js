/**
 * Pure helpers behind the "fiche d'identité" (site identity card). Most of
 * these are purely informational and don't feed the score — the exception
 * is checkMandatoryLegalMentions, since missing legally-required mentions
 * is actual evidence under French law (LCEN art. 6-III, Code de la
 * consommation), not just a best-practice nitpick like the SEO checklist.
 */

import { extractSirenOrSiret } from './siret.js';

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

// Tiered rather than one flat pattern: "mentions légales" / "legal notice"
// is the document that actually carries the mandatory-mentions template
// (SIRET, hébergeur, directeur de la publication...). A privacy policy or
// CGV/CGU is a real, often-separate document that legitimately won't
// contain most of those fields — if a site has both and we grab the
// privacy policy first just because it's earlier in the DOM, every
// mandatory-mentions check fails even on a fully compliant site. Lower
// priority number = checked first.
const LEGAL_LINK_TIERS = [
  { priority: 0, test: /mentions?\s*l[ée]gales?|legal\s*notice/i },
  { priority: 1, test: /cgv\b|cgu\b|conditions?\s*g[ée]n[ée]rales?|terms\s*(and|&)?\s*conditions/i },
  { priority: 2, test: /privacy\s*policy|politique\s*de\s*confidentialit[ée]|protection\s*des\s*donn[ée]es/i },
];

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
 * terms page, by link text — ordered so an actual "mentions légales" link
 * sorts before a privacy policy or CGV/CGU, since callers typically use
 * only the first result (see background/index.js's legalLinks[0]) and that
 * document is the one that actually carries the mandatory-mentions fields.
 *
 * Only same-domain links are considered. Plenty of sites outsource their
 * privacy policy to a third-party generator (Iubenda, TermsFeed...) and
 * link to it — a real, legitimate link, but that page is a generic
 * templated privacy notice hosted by someone else entirely, and
 * structurally cannot contain the site's own SIRET/dénomination/hébergeur.
 * Checking it for mandatory mentions isn't just weaker evidence, it's the
 * wrong document — confirmed live against adepem.com, which links to
 * iubenda.com for its privacy policy.
 * @param {Array<{text: string, href: string}>} links
 * @param {string} siteDomain the registrable domain of the site being analyzed
 */
export function findLegalLinks(links, siteDomain) {
  const matched = [];
  for (const link of links) {
    const tier = LEGAL_LINK_TIERS.find((t) => t.test.test(link.text || ''));
    if (!tier) continue;
    let hostname;
    try {
      hostname = new URL(link.href).hostname.toLowerCase();
    } catch {
      continue; // not an absolute URL: skip rather than guess
    }
    if (!hostnameMatchesDomain(hostname, siteDomain)) continue; // third-party-hosted: not useful here
    matched.push({ link, priority: tier.priority });
  }
  matched.sort((a, b) => a.priority - b.priority);
  return matched.map((m) => m.link);
}

/**
 * True when the current page's own title or URL path suggests it IS a
 * legal-notice/CGV/privacy document — for when no link on the page points
 * to one. Many sites don't hyperlink the nav item for the page you're
 * already on, so without this, visiting a legal page directly (rather than
 * via a link from elsewhere on the site) would find nothing to check even
 * though you're looking right at it. The URL path has its hyphens/
 * underscores turned into spaces first ("conditions-generales-vente" →
 * "conditions generales vente") so it matches the same patterns as link
 * text.
 * @param {string|null} title
 * @param {string} url
 */
export function pageLooksLikeOwnLegalDocument(title, url) {
  let pathAsWords = '';
  try {
    pathAsWords = new URL(url).pathname.replace(/[-_/]/g, ' ');
  } catch {
    pathAsWords = '';
  }
  const combined = `${title || ''} ${pathAsWords}`;
  return LEGAL_LINK_TIERS.some((tier) => tier.test.test(combined));
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
    // The city-name tail deliberately excludes whitespace (just one word,
    // not \s) — with it, a greedy/backtracking match on text with no comma
    // after the street (common: "104 rue de Maubeuge 75010 PARIS Immatriculation:...")
    // would bleed straight into the next field's label.
    /\b\d{1,4}[a-zA-Z]?\s*(?:,|\s)\s*(?:rue|avenue|boulevard|impasse|chemin|all[ée]e|route|place|quai|cours)\s+[^\n,;:]{3,60},?\s*\d{5}\s+[A-ZÀ-Ÿ][\wÀ-ÿ'\-]{1,30}\b/,
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

// Mandatory under LCEN art. 6-III for every site, commercial or not — no
// company type is exempt from these. Weighted per field, not per tier:
// SIRET/SIREN, address and dénomination are hard to fabricate convincingly
// and are exactly what the SIRET registry cross-check verifies, so they
// carry more weight (5) than the administrative fields (contact, hébergeur,
// directeur de publication, weight 2) that plenty of legitimate small sites
// genuinely forget without that saying much about fraud intent.
const UNIVERSAL_LEGAL_MENTIONS = [
  {
    key: 'legalForm',
    label: 'Dénomination sociale / forme juridique',
    weight: 5,
    // Either an actual legal-form keyword, or the "dénomination sociale" /
    // "raison sociale" label itself — a page can properly name the company
    // ("Dénomination sociale : ADEPEM") without restating one of these
    // specific abbreviations, and that's just as valid.
    test: (t) =>
      /\b(sarl|sasu?|eurl|scp|sci|snc|ei|eirl|auto-entrepreneur|micro-entreprise|associations?|assoc\.?)\b/i.test(t)
      || /d[ée]nomination\s+sociale|raison\s+sociale/i.test(t),
  },
  {
    key: 'siren',
    label: 'Numéro SIRET/SIREN',
    weight: 5,
    // Reuses the same extraction the SIRET registry cross-check uses (see
    // core/siret.js), which also catches a SIREN given via its RCS
    // registration ("RCS Paris B 321045395") rather than literally labeled
    // "SIREN" — a real, common pattern a plain keyword search would miss.
    test: (t) => extractSirenOrSiret(t) !== null,
  },
  { key: 'address', label: 'Adresse du siège social', weight: 5, test: (t) => Boolean(extractPhysicalAddress(t)) },
  {
    key: 'contact',
    label: 'Coordonnées de contact (téléphone ou email)',
    weight: 2,
    test: (t) => /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t) || /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/.test(t),
  },
  { key: 'host', label: "Identité de l'hébergeur du site", weight: 2, test: (t) => /h[ée]bergeur|h[ée]bergement du site/i.test(t) },
  {
    key: 'publicationDirector',
    label: 'Directeur de la publication',
    weight: 2,
    test: (t) => /directeur\s+(?:de\s+la\s+)?publication|responsable\s+(?:de\s+la\s+)?publication/i.test(t),
  },
];

// Only mandatory for certain company types or activities — a sole trader
// (auto-entrepreneur) legitimately has no RCS number or share capital, and a
// VAT-exempt small business legitimately has no intracommunity VAT number.
// Weighted lower in scoring for exactly that reason.
const CONDITIONAL_LEGAL_MENTIONS = [
  { key: 'rcs', label: "Immatriculation RCS", weight: 2, test: (t) => /\brcs\b/i.test(t) },
  {
    key: 'capital',
    label: 'Capital social',
    weight: 2,
    // "Capital social" as an exact phrase, or just "Capital :" followed by
    // an amount — real pages often write the shorter form and it's just as
    // clear from context.
    // `\b` doesn't work after "€" (not a word character) — it only
    // belongs on the "euros?" branch, not shared across the alternation.
    test: (t) => /capital\s+social/i.test(t) || /\bcapital\s*:?\s*[\d][\d.,\s]*\s*(?:€|euros?\b)/i.test(t),
  },
  {
    key: 'vat',
    label: 'Numéro de TVA intracommunautaire',
    weight: 2,
    test: (t) => /tva\s+intracommunautaire/i.test(t) || /\bfr\d{2}\s?\d{9}\b/i.test(t),
  },
  {
    key: 'mediator',
    label: 'Médiateur de la consommation',
    weight: 2,
    test: (t) => /m[ée]diat(?:eur|rice|ion)/i.test(t) && /consommation/i.test(t),
  },
];

/**
 * Checks a legal-notice page's text against the mandatory-mentions template
 * for French websites. Returns null when there's no text to check (the
 * caller should treat "no legal page at all" as a separate, stronger
 * signal — see core/scoring.js).
 * @param {string|null} text
 */
export function checkMandatoryLegalMentions(text) {
  if (!text) return null;
  const check = (field) => ({ key: field.key, label: field.label, weight: field.weight, present: field.test(text) });
  const universal = UNIVERSAL_LEGAL_MENTIONS.map(check);
  const conditional = CONDITIONAL_LEGAL_MENTIONS.map(check);
  return {
    universal,
    conditional,
    missingUniversalCount: universal.filter((m) => !m.present).length,
    missingConditionalCount: conditional.filter((m) => !m.present).length,
  };
}

// Named entities worth decoding beyond the basic five: older/legacy-authored
// pages routinely spell out accented French letters and the euro sign this
// way rather than embedding the literal UTF-8 character. Left undecoded,
// "D&eacute;nomination" or "15,90&nbsp;&euro;" silently break any regex that
// expects to see "é" or "€" — found via a real mandatory-mentions page that
// used exactly this encoding.
const NAMED_HTML_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Euml: 'Ë',
  agrave: 'à', acirc: 'â', auml: 'ä',
  Agrave: 'À', Acirc: 'Â', Auml: 'Ä',
  ccedil: 'ç', Ccedil: 'Ç',
  ocirc: 'ô', ouml: 'ö', Ocirc: 'Ô', Ouml: 'Ö',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  Ugrave: 'Ù', Ucirc: 'Û', Uuml: 'Ü',
  icirc: 'î', iuml: 'ï', Icirc: 'Î', Iuml: 'Ï',
  ntilde: 'ñ', Ntilde: 'Ñ',
  oelig: 'œ', OElig: 'Œ', aelig: 'æ', AElig: 'Æ',
  euro: '€', pound: '£', cent: '¢', yen: '¥',
  deg: '°', hellip: '…', ndash: '–', mdash: '—',
  laquo: '«', raquo: '»',
};

/**
 * Decodes numeric (&#233; / &#xE9;) and the common named HTML entities —
 * not a full HTML5 entity table, but enough for French legal-page text.
 * @param {string} text
 */
function decodeHtmlEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (full, name) => (name in NAMED_HTML_ENTITIES ? NAMED_HTML_ENTITIES[name] : full));
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
  const withoutTags = withoutNoise.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

/**
 * Pulls email/phone contact info out of mailto:/tel: links in the raw HTML.
 * Many sites show a "Nous contacter" link whose visible text never includes
 * the actual address — stripHtmlToText discards href attributes along with
 * every other tag, so that contact info would otherwise be invisible to the
 * mandatory-mentions check even though it genuinely exists on the page.
 * Returns a text fragment meant to be appended to the stripped page text,
 * not the raw addresses themselves (callers don't need to parse this).
 * @param {string} html
 */
export function extractContactLinks(html) {
  const emails = [...html.matchAll(/href\s*=\s*["']mailto:([^"'?]+)/gi)].map((m) => m[1]);
  const phones = [...html.matchAll(/href\s*=\s*["']tel:([^"']+)/gi)].map((m) => m[1]);
  return [...emails, ...phones].join(' ');
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
