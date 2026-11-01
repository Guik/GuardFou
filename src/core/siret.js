import { normalize } from './brands.js';

/**
 * Finds a SIRET (14 digits) or SIREN (9 digits) candidate in free text,
 * preferring an explicit "SIRET"/"SIREN" label over a bare digit run (which
 * could be a phone number or postal code taken out of context).
 * @param {string} text
 * @returns {{type: 'siret'|'siren', digits: string}|null}
 */
export function extractSirenOrSiret(text) {
  const siretLabeled = text.match(/siret\s*:?\s*([\d\s]{14,20})/i);
  if (siretLabeled) {
    const digits = siretLabeled[1].replace(/\D/g, '');
    if (digits.length >= 14) return { type: 'siret', digits: digits.slice(0, 14) };
  }

  const sirenLabeled = text.match(/siren\s*:?\s*([\d\s]{9,14})/i);
  if (sirenLabeled) {
    const digits = sirenLabeled[1].replace(/\D/g, '');
    if (digits.length >= 9) return { type: 'siren', digits: digits.slice(0, 9) };
  }

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
