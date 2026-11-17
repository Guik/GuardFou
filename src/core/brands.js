import { COMMON_WORDS } from '../data/common-words.js';

const GENERIC_SUFFIXES = [
  'construction', 'shop', 'store', 'outlet', 'officiel', 'official',
  'france', 'fr', 'direct', 'discount', 'promo', 'solde', 'soldes',
  'destock', 'destockage', 'vente', 'boutique',
];

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// What separates the parts of a site name or title: "La Poste | Suivi",
// "Colissimo - Votre colis", "Accueil • La Poste".
const NAME_SEPARATORS = /\s+[|•·:\-–—]\s+|\s*[|•·]\s*/;

/**
 * Find the first brand whose alias appears as a whole word/phrase in the
 * given text. Longest alias wins when several match, so "point p" beats a
 * shorter accidental overlap. An alias listed in the brand's exactAliases
 * must instead be a whole part of the text: "La Poste" or "La Poste | Suivi"
 * names La Poste, "Hôtel de la Poste" doesn't.
 * @param {string} text free text claiming to be a brand (title, og:site_name, footer...)
 * @param {Array<{name:string, aliases:string[], exactAliases?:string[], officialDomains:string[]}>} brands
 */
export function findBrandByAlias(text, brands) {
  const normalizedText = normalize(text);
  if (!normalizedText) return null;
  const parts = new Set(text.split(NAME_SEPARATORS).map(normalize).filter(Boolean));

  let best = null;
  for (const brand of brands) {
    const exact = new Set((brand.exactAliases ?? []).map(normalize));
    for (const alias of brand.aliases) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) continue;
      const matches = exact.has(normalizedAlias)
        ? parts.has(normalizedAlias)
        : new RegExp(`\\b${escapeRegExp(normalizedAlias)}\\b`).test(normalizedText);
      if (matches && (!best || normalizedAlias.length > best.aliasLength)) {
        best = { brand, aliasLength: normalizedAlias.length };
      }
    }
  }
  return best ? best.brand : null;
}

/**
 * The text a page uses to name itself, for brand matching. og:site_name
 * and the JSON-LD organization are the site's own name, so a brand there is
 * a real claim — and when the site declares one, its title and footer don't
 * count: a comparison site's "Abonnement EDF" guide, named "LesFurets", is
 * about EDF, not EDF. Without a declared name, the title and footer only
 * count on a page that also looks like a shop: elsewhere they're routinely
 * about a brand rather than from it — a news headline "Fnac Darty publie
 * ses résultats", or a bakery titled "Boulanger artisan à Lyon".
 * @param {{ogSiteName?:string|null, jsonLdOrgName?:string|null, title?:string|null, footerCopyright?:string|null, isLikelyShop?:boolean}} payload
 */
export function getBrandClaimText(payload) {
  const siteName = [payload?.ogSiteName, payload?.jsonLdOrgName].filter(Boolean);
  if (siteName.length > 0) return siteName.join(' • ');
  const pageText = payload?.isLikelyShop ? [payload?.title, payload?.footerCopyright] : [];
  return pageText.filter(Boolean).join(' • ');
}

/** @param {string} domain @param {{officialDomains:string[]}} brand */
export function isOfficialDomain(domain, brand) {
  return brand.officialDomains.includes(domain);
}

/**
 * True when a domain looks like "<brand><generic word>" or "<brand>-fr" etc.,
 * the classic phishing/clone pattern (e.g. "chaussonconstruction.com").
 * A commonWord brand only uses its multi-word aliases here, so a bakery
 * called "boulangershop" is not reported as a clone of Boulanger.
 * @param {string} domainLabel the domain without its public suffix, e.g. "chaussonconstruction"
 * @param {{aliases:string[], commonWord?:boolean}} brand
 */
export function looksLikeBrandPlusGenericWord(domainLabel, brand) {
  const label = normalize(domainLabel).replace(/\s/g, '');
  for (const alias of brand.aliases) {
    if (brand.commonWord && !normalize(alias).includes(' ')) continue;
    const aliasKey = normalize(alias).replace(/\s/g, '');
    if (!aliasKey || !label.startsWith(aliasKey)) continue;
    const rest = label.slice(aliasKey.length);
    if (rest.length === 0) continue; // exact match handled by isOfficialDomain
    if (GENERIC_SUFFIXES.some((word) => rest === word || rest === `-${word}`)) {
      return true;
    }
  }
  return false;
}

/** Levenshtein edit distance, used to catch near-miss spellings of a brand's domain. */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * How many typos still count as "the same name": none for very short
 * labels, where one edit turns a brand into an ordinary word ("darty" →
 * "party", "fnac" → "frac"), and two only for long ones.
 * @param {number} length
 */
function maxTypoDistance(length) {
  if (length >= 10) return 2;
  if (length >= 5) return 1;
  return 0;
}

/**
 * True when domainLabel is a near-miss spelling of one of the brand's
 * official domain labels, e.g. "chaussson" vs "chausson". Both sides are
 * normalized the same way (hyphens dropped) — otherwise "mr-bricolage"
 * would count as one edit away from itself. The first letter must match:
 * typosquats keep it so the name still reads right at a glance, and it
 * rules out most real words that happen to be one edit away.
 * A commonWord brand never has typos: "boulangr" is one letter from
 * "boulanger" but is not a clone of it. A label that is itself a common
 * word is never a typo either: "dart" is not Darty, "point" is not Point.P.
 * @param {string} domainLabel
 * @param {{officialDomains:string[], commonWord?:boolean}} brand
 */
export function isNearMissSpelling(domainLabel, brand) {
  if (brand.commonWord) return false;
  const label = normalize(domainLabel).replace(/\s/g, '');
  if (COMMON_WORDS.has(label)) return false;
  return brand.officialDomains.some((officialDomain) => {
    const officialLabel = normalize(officialDomain.split('.')[0]).replace(/\s/g, '');
    if (label === officialLabel || label[0] !== officialLabel[0]) return false;
    return levenshtein(label, officialLabel) <= maxTypoDistance(officialLabel.length);
  });
}

/**
 * The brand this domain imitates — "<brand><generic word>" or a near-miss
 * spelling of an official domain — or null. Checked against every brand,
 * independently of what the page itself claims to be: a clone that never
 * names the brand in its title is still given away by its domain.
 * @param {string} domain registrable domain, e.g. "chaussonconstruction.com"
 * @param {string} domainLabel the domain without its public suffix
 * @param {Array<{name:string, aliases:string[], officialDomains:string[]}>} brands
 */
export function findLookalikeBrand(domain, domainLabel, brands) {
  // A domain a brand really uses is never a clone of another brand, even when
  // its label is one typo from that brand's ("maif" vs "macif").
  if (brands.some((brand) => isOfficialDomain(domain, brand))) return null;
  return brands.find((brand) => looksLikeBrandPlusGenericWord(domainLabel, brand) || isNearMissSpelling(domainLabel, brand)) ?? null;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
