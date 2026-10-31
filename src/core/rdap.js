/**
 * Pure parsing of an RDAP domain response (https://rdap.org/domain/<domain>),
 * kept separate from the fetch/cache wrapper so it's testable with fixture
 * JSON and no network.
 */

/**
 * Domain registration age in days from the "registration" event.
 * @param {{events?: Array<{eventAction:string, eventDate:string}>}} rdapData
 * @returns {number|null}
 */
export function extractDomainAgeDays(rdapData) {
  const registrationEvent = (rdapData?.events || []).find((e) => e.eventAction === 'registration');
  if (!registrationEvent) return null;
  const registeredAt = new Date(registrationEvent.eventDate).getTime();
  if (Number.isNaN(registeredAt)) return null;
  return Math.max(0, Math.round((Date.now() - registeredAt) / 86400000));
}

/**
 * Registration/last-change/expiration dates from the RDAP events array, as
 * ISO strings (or null when absent) — for display, not scoring.
 * @param {{events?: Array<{eventAction:string, eventDate:string}>}} rdapData
 */
export function extractDomainDates(rdapData) {
  const findEvent = (action) => (rdapData?.events || []).find((e) => e.eventAction === action)?.eventDate ?? null;
  return {
    registeredAt: findEvent('registration'),
    lastChangedAt: findEvent('last changed'),
    expiresAt: findEvent('expiration'),
  };
}

/**
 * True when the domain was registered for only about a year (registration
 * to expiration), the cheapest commitment a registrar offers. On its own
 * this proves nothing — plenty of real sites just renew annually for
 * years — it's only meaningful paired with a domain that's also brand new
 * (see core/scoring.js): a long-term business usually secures its domain
 * for several years up front, while a throwaway site typically doesn't.
 * @param {string|null} registeredAt ISO date
 * @param {string|null} expiresAt ISO date
 * @returns {boolean}
 */
export function isShortRegistrationSpan(registeredAt, expiresAt) {
  if (!registeredAt || !expiresAt) return false;
  const start = new Date(registeredAt).getTime();
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const spanDays = (end - start) / 86400000;
  return spanDays > 0 && spanDays <= 370; // ~1 year, with slack for leap years/billing quirks
}

/**
 * Registrar's display name (vCard "fn") from the entity with role "registrar".
 * @param {{entities?: Array<{roles?: string[], vcardArray?: [string, Array<any[]>]}>}} rdapData
 * @returns {string|null}
 */
export function extractRegistrarName(rdapData) {
  const registrarEntity = (rdapData?.entities || []).find((e) => e.roles?.includes('registrar'));
  const vcardFields = registrarEntity?.vcardArray?.[1];
  if (!Array.isArray(vcardFields)) return null;
  const fnField = vcardFields.find((field) => field[0] === 'fn');
  return typeof fnField?.[3] === 'string' ? fnField[3] : null;
}
