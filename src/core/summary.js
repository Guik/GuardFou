// What the popup shows about a site at a glance (domain, company, legal
// notice) and the dates on its identity card's timeline. Built from the
// lookups the background already runs; nothing here fetches.

/**
 * The facts kept with a tab's verdict for the popup's summary. Each part
 * is null when its lookup didn't run (not a shop, trusted site...).
 * @param {{
 *   rdapInfo?: { registeredAt: string|null, lastChangedAt: string|null, expiresAt: string|null, registrarName: string|null } | null,
 *   legalAnalysis?: { legal: { present: boolean }, mandatoryMentions: { missingUniversalCount: number, missingConditionalCount: number } | null, companyCheck: object } | null,
 * }} lookups
 */
export function buildSiteFacts({ rdapInfo = null, legalAnalysis = null }) {
  const domain = rdapInfo?.registeredAt || rdapInfo?.registrarName
    ? {
        registeredAt: rdapInfo.registeredAt,
        lastChangedAt: rdapInfo.lastChangedAt,
        expiresAt: rdapInfo.expiresAt,
        registrarName: rdapInfo.registrarName,
      }
    : null;
  if (!legalAnalysis) return { domain, legal: null, company: null };

  const mentions = legalAnalysis.mandatoryMentions;
  const { candidate, checksumValid, registry } = legalAnalysis.companyCheck;
  return {
    domain,
    legal: {
      found: legalAnalysis.legal.present,
      unreadable: Boolean(legalAnalysis.unreadable),
      missing: mentions ? mentions.missingUniversalCount + mentions.missingConditionalCount : null,
    },
    company: {
      hasNumber: Boolean(candidate),
      checksumValid,
      found: registry ? registry.found : null,
      name: registry?.name ?? null,
      status: registry?.status ?? null,
      creationDate: registry?.creationDate ?? null,
      country: registry?.country ?? null,
    },
  };
}

/**
 * Dated events for the timeline, oldest first, with "today" in its place.
 * @param {{ companyCreated?: string|null, domainRegistered?: string|null, domainChanged?: string|null, domainExpires?: string|null }} dates ISO strings
 * @param {Date} [now]
 * @returns {{ key: string, date: Date, future: boolean }[]}
 */
export function timelineEvents(dates, now = new Date()) {
  const events = Object.entries(dates)
    .map(([key, iso]) => ({ key, date: iso ? new Date(iso) : null }))
    .filter((e) => e.date && !Number.isNaN(e.date.getTime()));
  if (events.length === 0) return [];
  events.push({ key: 'today', date: now });
  return events
    .sort((a, b) => a.date - b.date)
    .map((e) => ({ ...e, future: e.date > now }));
}

/**
 * The distance between two dates in the largest whole unit, signed like
 * Intl.RelativeTimeFormat expects (negative for the past).
 * @param {Date} date
 * @param {Date} [now]
 * @returns {{ value: number, unit: 'year'|'month'|'day' }}
 */
export function relativeTime(date, now = new Date()) {
  const days = (date - now) / 86_400_000;
  const sign = days < 0 ? -1 : 1;
  const abs = Math.abs(days);
  if (abs >= 365) return { value: sign * Math.floor(abs / 365.25), unit: 'year' };
  if (abs >= 30) return { value: sign * Math.floor(abs / 30.44), unit: 'month' };
  return { value: sign * Math.floor(abs), unit: 'day' };
}

// INSEE "tranche d'effectif salarié" codes; NN means not published.
const EMPLOYEE_RANGES = {
  '00': '0', '01': '1–2', '02': '3–5', '03': '6–9', '11': '10–19', '12': '20–49', '21': '50–99',
  '22': '100–199', '31': '200–249', '32': '250–499', '41': '500–999', '42': '1 000–1 999',
  '51': '2 000–4 999', '52': '5 000–9 999', '53': '10 000+',
};

/** @param {string|null|undefined} code */
export function employeeRange(code) {
  return EMPLOYEE_RANGES[code] ?? null;
}

// The legal forms (INSEE "catégorie juridique") with a label of their own
// in _locales (legalForm_<code>); other codes are shown as a number.
export const LABELLED_LEGAL_FORMS = ['1000', '3220', '5202', '5498', '5499', '5599', '5699', '5710', '5720', '6540', '9220'];

// NAF sections, labelled in _locales as nafSection_<letter>.
export const NAF_SECTIONS = 'ABCDEFGHIJKLMNOPQRSTU'.split('');

/** "ESPAGNE" → "Espagne", "ROYAUME-UNI" → "Royaume-Uni". */
export function titleCaseCountry(name) {
  return name.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}
