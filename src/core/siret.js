import { normalize } from './brands.js';

/**
 * Finds a SIRET (14 digits) or SIREN (9 digits) candidate in free text,
 * preferring an explicit "SIRET"/"SIREN" label over a bare digit run (which
 * could be a phone number or postal code taken out of context).
 * @param {string} text
 * @returns {{type: 'siret'|'siren', digits: string}|null}
 */
export function extractSirenOrSiret(text) {
  // Legal notices also give the host's numbers ("Hébergeur : 1&1 Internet
  // SARL… SIRET : 431 303 775 00016", seen on yesassurances.fr before the
  // publisher's own): a number in the hosting section is only used when
  // there's no other.
  const pick = (regex, read) => {
    let fallback = null;
    for (const match of text.matchAll(regex)) {
      const found = read(match);
      if (!found) continue;
      if (!inHostingSection(text, match.index)) return found;
      fallback ??= found;
    }
    return fallback;
  };

  const siretLabeled = pick(/siret\s*:?\s*([\d\s]{14,20})/gi, (m) => {
    const digits = m[1].replace(/\D/g, '');
    return digits.length >= 14 ? { type: 'siret', digits: digits.slice(0, 14) } : null;
  });
  if (siretLabeled) return siretLabeled;

  const sirenLabeled = pick(/siren\s*:?\s*([\d\s]{9,14})/gi, (m) => {
    const digits = m[1].replace(/\D/g, '');
    return digits.length >= 9 ? { type: 'siren', digits: digits.slice(0, 9) } : null;
  });
  if (sirenLabeled) return sirenLabeled;

  // A company's SIREN is routinely given via its RCS registration instead
  // of the word "SIREN" itself, e.g. "RCS Paris B 321045395" — real text
  // seen on an actual legal-notice page, which the two checks above missed
  // entirely despite the number being right there.
  const rcsLabeled = pick(/\brcs\b[^\n]{0,40}?(\d[\d\s]{7,13}\d)/gi, (m) => {
    const digits = m[1].replace(/\D/g, '');
    return digits.length === 9 ? { type: 'siren', digits } : null;
  });
  if (rcsLabeled) return rcsLabeled;

  const bareSiret = text.match(/\b\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5}\b/);
  if (bareSiret) return { type: 'siret', digits: bareSiret[0].replace(/\D/g, '') };

  return null;
}

/**
 * Luhn checksum, the algorithm SIREN/SIRET numbers are built with (applied
 * to the full 14 digits for a SIRET, not just the 5-digit NIC suffix).
 * @param {string} digits
 */
function luhnValid(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** @param {string} digits exactly 9 digits */
export function isValidSiren(digits) {
  return /^\d{9}$/.test(digits) && luhnValid(digits);
}

/** @param {string} digits exactly 14 digits */
export function isValidSiret(digits) {
  return /^\d{14}$/.test(digits) && luhnValid(digits);
}

/**
 * Checks a SIREN/SIRET candidate's checksum regardless of its type.
 * @param {{type: 'siret'|'siren', digits: string}} candidate
 */
export function isValidSirenOrSiret(candidate) {
  return candidate.type === 'siret' ? isValidSiret(candidate.digits) : isValidSiren(candidate.digits);
}

/**
 * Best-effort check that a registered company name shares most of its
 * significant words with the brand/name a page claims to be — catches a
 * scammer reusing someone else's real, valid SIRET while presenting as a
 * different business. Returns true (don't penalize) when there's nothing
 * meaningful to compare.
 * @param {string|null} registeredName e.g. "CHAUSSON MATERIAUX"
 * @param {string} claimedText free text the page presents itself as
 */
export function companyNameMatchesClaim(registeredName, claimedText) {
  if (!registeredName || !claimedText) return true;
  const registeredWords = normalize(registeredName)
    .split(' ')
    .filter((w) => w.length > 2);
  if (registeredWords.length === 0) return true;
  const normalizedClaimed = normalize(claimedText);
  const matchCount = registeredWords.filter((w) => normalizedClaimed.includes(w)).length;
  return matchCount / registeredWords.length >= 0.5;
}

// Section headings that say whose details follow: the host's, or the
// publisher's. A number belongs to the closer one before it.
const HOSTING_HEADING = /h[ée]berg(?:eur|ement|[ée]e?\s+(?:par|chez))|\bhost(?:ing|ed\s+by)\b/gi;
const PUBLISHER_HEADING = /[ée]dit[ée]e?\s+par|[ée]diteur|propri[ée]taire|\bpublisher\b/gi;
const SECTION_LOOKBACK = 400;

/** True when the closest section heading before `index` is the host's. */
function inHostingSection(text, index) {
  const before = text.slice(Math.max(index - SECTION_LOOKBACK, 0), index);
  const lastIndex = (regex) => Math.max(-1, ...[...before.matchAll(regex)].map((m) => m.index));
  const host = lastIndex(HOSTING_HEADING);
  return host >= 0 && host > lastIndex(PUBLISHER_HEADING);
}

const PUBLISHER_INTRO = /[ée]dit[ée]e?\s+par|[ée]diteur(?:\s+du\s+site)?|exploit[ée]e?\s+par|publi[ée]e?\s+par|g[ée]r[ée]e?\s+par|(?:la\s+)?propri[ée]t[ée]\s+(?:exclusive\s+)?de|appartenant\s+[àa]|raison\s+sociale|d[ée]nomination(?:\s+sociale)?/gi;
// A company number: the company's name is almost always written just
// before it ("La Centrale de Financement, SAS au capital de…, RCS Paris…").
const COMPANY_ID = /\b(?:siret|siren|rcs)\b/gi;

/**
 * Where a legal notice names the company behind the site, which can differ
 * from its brand ("édité par PLANETE HOME SLU, exerçant sous l'enseigne
 * « CHAUFFAGE ET CLIMATISATION »"): the words right after each "édité
 * par", "éditeur", "propriété de", "raison sociale"…, and the words just
 * before each SIRET/SIREN/RCS. Kept short (under a thousand characters)
 * because it's cached with the rest of the legal analysis.
 * @param {string|null} text
 */
export function extractPublisherStatements(text) {
  if (!text) return '';
  const after = [...text.matchAll(PUBLISHER_INTRO)].map((m) => text.slice(m.index + m[0].length, m.index + m[0].length + 120));
  const before = [...text.matchAll(COMPANY_ID)].map((m) => text.slice(Math.max(m.index - 150, 0), m.index));
  // Interleaved so that a notice with many of one kind still keeps the other.
  const excerpts = [];
  for (let i = 0; i < Math.max(after.length, before.length); i += 1) {
    if (after[i]) excerpts.push(after[i]);
    if (before[i]) excerpts.push(before[i]);
  }
  return excerpts.join(' • ').slice(0, 900);
}
