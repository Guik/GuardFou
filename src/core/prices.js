// Slashed prices: fake shops show every product at a fraction of its usual
// price, often a real designer piece at -70 or -80 %. A genuine shop holds a
// sale too (Black Friday, clearance), so this only counts on a new domain
// (see core/scoring.js).

const CURRENCY = String.raw`€|\$|£|\b(?:eur|usd|gbp|chf)\b`;
// Thousands grouped by dots, commas or spaces ("2.448,00", "2,448.00",
// "2 448,00"), or a plain number with up to two decimals.
const AMOUNT = String.raw`\d{1,3}(?:[.,\s  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const PRICE = new RegExp(String.raw`(?:${CURRENCY})\s*(${AMOUNT})|(${AMOUNT})\s*(?:${CURRENCY})`, 'gi');

/** Discount from which a price counts as slashed. */
const STEEP_PERCENT = 50;
/** Distinct slashed products needed before saying anything. */
const MIN_PRICE_CUTS = 3;

/**
 * "2.448,00" → 2448, "2,448.00" → 2448, "489,60" → 489.6, "1 299" → 1299.
 * @param {string} raw
 * @returns {number|null}
 */
export function parseAmount(raw) {
  const compact = raw.replace(/[\s  ]/g, '');
  const lastDot = compact.lastIndexOf('.');
  const lastComma = compact.lastIndexOf(',');
  let normalized;
  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = compact.split(thousands).join('').replace(decimal, '.');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const separator = lastDot !== -1 ? '.' : ',';
    const groups = compact.split(separator);
    // A single separator followed by exactly three digits groups thousands
    // ("2.448", "1,299"); otherwise it marks the decimals ("489,60").
    const isThousands = groups.length > 2 || groups[1].length === 3;
    normalized = isThousands ? groups.join('') : groups.join('.');
  } else {
    normalized = compact;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Every amount written with a currency in `text`.
 * @param {string} text
 * @returns {number[]}
 */
export function findPrices(text) {
  const amounts = [];
  for (const match of (text || '').matchAll(PRICE)) {
    const amount = parseAmount(match[1] ?? match[2]);
    if (amount !== null) amounts.push(amount);
  }
  return amounts;
}

/**
 * Sums up the slashed prices a page shows. Each cut is the text of a struck
 * price (`was`) and the text around it (`now`), where the price paid is the
 * lowest amount under the struck one: the surrounding text can also repeat
 * the old price, as WooCommerce does for screen readers.
 * @param {{ was: string, now: string }[]} cuts
 * @returns {{ count: number, steepCount: number, maxPercent: number }}
 */
export function summarizePriceCuts(cuts) {
  const seen = new Set();
  const percents = [];
  for (const cut of cuts || []) {
    const [was] = findPrices(cut?.was);
    if (!was) continue;
    const lower = findPrices(cut?.now).filter((amount) => amount < was);
    if (lower.length === 0) continue;
    const now = Math.min(...lower);
    // The same product often shows its price twice (grid and quick view,
    // or the page and a sticky add-to-cart bar).
    const key = `${was}|${now}`;
    if (seen.has(key)) continue;
    seen.add(key);
    percents.push(Math.round((1 - now / was) * 100));
  }
  return {
    count: percents.length,
    steepCount: percents.filter((percent) => percent >= STEEP_PERCENT).length,
    maxPercent: percents.length ? Math.max(...percents) : 0,
  };
}

/**
 * True when most of the page's slashed prices are cut by half or more.
 * @param {{ count: number, steepCount: number }} summary
 */
export function hasSteepDiscounts(summary) {
  return summary.count >= MIN_PRICE_CUTS && summary.steepCount * 3 >= summary.count * 2;
}
