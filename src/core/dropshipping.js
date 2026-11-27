import { VIRTUAL_OFFICE_ADDRESSES, ASIAN_SELLER_PLACES } from '../data/dropshipping.js';
import { inHostingSection } from './siret.js';
import { hostnameMatchesDomain } from './identity.js';

/**
 * Clues that a shop is dropshipping, read from its legal notice, terms or
 * shipping policy or FAQ. Dropshipping is not a scam, so these never touch the risk
 * score: they only feed the optional dropshipping alert.
 * @param {string|null} text
 * @returns {{ virtualOffice: string|null, sellerPlace: string|null, shipsFromAsia: string|null, longDelivery: string|null, splitShipments: boolean }}
 */
export function findDropshippingClues(text) {
  if (!text) return { virtualOffice: null, sellerPlace: null, shipsFromAsia: null, longDelivery: null, splitShipments: false };
  return {
    virtualOffice: findVirtualOfficeAddress(text),
    sellerPlace: findAsianSellerPlace(text),
    shipsFromAsia: findShipsFromAsia(text),
    longDelivery: findLongDelivery(text),
    splitShipments: SPLIT_SHIPMENTS.test(text),
  };
}

/** The name of a known dropshipping registered office in the text, or null. */
export function findVirtualOfficeAddress(text) {
  return VIRTUAL_OFFICE_ADDRESSES.find((address) => address.pattern.test(text))?.name ?? null;
}

function foldAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const PLACE_PATTERNS = ASIAN_SELLER_PLACES.map((place) => ({
  place,
  pattern: new RegExp(`\\b${foldAccents(place).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'g'),
}));

// Words that come shortly before a place when it is part of an address:
// "Flat/RM 9 4/F, Beverley Commercial Centre, Tsim Sha Tsui, Kowloon",
// "Siège social : … Shenzhen".
const ADDRESS_CUE = /\b(?:flat|unit|room|rm|floor|\d+\/f|road|rd|street|st|avenue|ave|building|bldg|centre|center|tower|plaza|district|si[eè]ge|adresse|address|located|situee?|domiciliee?)\b/;
const ADDRESS_LOOKBACK = 100;
// A shop's country selector lists every country with its currency:
// "R.A.S. chinoise de Hong Kong EUR €". That is not the seller's address.
const CURRENCY_AFTER = /^\s*(?:\(?[a-z]{3}\)?\s*)?(?:€|\$|£|¥|eur\b|hkd\b|usd\b|cny\b)/;

/**
 * A place in Hong Kong or mainland China written as part of an address,
 * outside the host's section ("Hébergeur : Alibaba Cloud, Hangzhou" is about
 * the host, not the seller), or null. The first place in ASIAN_SELLER_PLACES
 * order wins, so the answer is "Hong Kong" rather than the district before it.
 */
export function findAsianSellerPlace(text) {
  const folded = foldAccents(text);
  for (const { place, pattern } of PLACE_PATTERNS) {
    for (const match of folded.matchAll(pattern)) {
      const before = folded.slice(Math.max(match.index - ADDRESS_LOOKBACK, 0), match.index);
      const after = folded.slice(match.index + match[0].length, match.index + match[0].length + 12);
      if (!ADDRESS_CUE.test(before) || CURRENCY_AFTER.test(after)) continue;
      if (!inHostingSection(folded, match.index)) return place;
    }
  }
  return null;
}

// The shop saying itself that orders leave from Asia: "your order is shipped
// from global areas such as Thailand, Tibet, China", "expédiés depuis nos
// entrepôts en Chine". "Fabriqué en Chine" is about the product, not the
// shipping, and is left out.
const ASIA = String.raw`\b(?:China|Chine|Hong\s+Kong|Asia|Asie|Shenzhen|Guangzhou|Yiwu)\b`;
const SHIPS_FROM_ASIA = [
  new RegExp(String.raw`\b(?:ship(?:s|ped|ping)?|dispatch(?:es|ed)?|sent)\s+(?:directly\s+)?from\s+[^.!?]{0,60}?${ASIA}`, 'gi'),
  new RegExp(String.raw`\b(?:warehouses?|suppliers?|factor(?:y|ies))\s+(?:are\s+|is\s+)?(?:located\s+|based\s+)?in\s+[^.!?]{0,30}?${ASIA}`, 'gi'),
  new RegExp(String.raw`\b(?:exp[ée]di(?:[ée]e?s?|ons)|envoy[ée]e?s?|livr[ée]e?s?|achemin[ée]e?s?|livraison)\s+(?:directement\s+)?(?:depuis|de|en\s+provenance\s+d[e'’])\s+[^.!?]{0,60}?${ASIA}`, 'gi'),
  new RegExp(String.raw`\b(?:entrep[ôo]ts?|fournisseurs?|usines?)\s+(?:sont\s+|est\s+)?(?:situ[ée]e?s?\s+|bas[ée]e?s?\s+|implant[ée]e?s?\s+)?(?:en|à|a)\s+[^.!?]{0,30}?${ASIA}`, 'gi'),
];
// Where the parcels go rather than where they come from: "we ship from
// Paris to Europe and Asia", "livraison de vos colis partout, y compris en Asie".
const DESTINATION = /\b(?:to|towards|worldwide|including|vers|partout|y\s+compris|destination|monde)\b/i;
// "We don't ship from China", "nous n'expédions pas depuis la Chine".
const NEGATION_BEFORE = /(?:\bnot|n['’]t|\bnever|\bjamais|\bne|\bn['’])\s*\S*\s*$/i;
const MAX_QUOTE = 120;

/**
 * The sentence part in which the shop says its orders ship from Asia, as
 * written, or null.
 */
export function findShipsFromAsia(text) {
  const found = [];
  for (const pattern of SHIPS_FROM_ASIA) {
    for (const match of text.matchAll(pattern)) {
      if (DESTINATION.test(match[0]) || NEGATION_BEFORE.test(text.slice(Math.max(match.index - 25, 0), match.index))) continue;
      found.push(match);
    }
  }
  found.sort((a, b) => a.index - b.index);
  const quote = found[0]?.[0].replace(/\s+/g, ' ').trim();
  return quote ? quote.slice(0, MAX_QUOTE) : null;
}

// A delivery time measured in weeks or in weeks' worth of days. Only the
// longest figure counts: "3 à 5 jours" is a normal French delivery.
const DELIVERY_TIMES = [
  { pattern: /(\d{1,2})\s*(?:à|a|-|–|to|et|and)\s*(\d{1,2})\s*(?:semaines|weeks)/gi, minimum: 3 },
  { pattern: /(?:jusqu['’]?\s*[àa]|up\s+to)\s*()(\d{1,2})\s*(?:semaines|weeks)/gi, minimum: 3 },
  { pattern: /(\d{1,2})\s*(?:à|a|-|–|to|et|and)\s*(\d{1,2})\s*(?:jours|days|business\s+days)/gi, minimum: 15 },
  { pattern: /(?:jusqu['’]?\s*[àa]|up\s+to)\s*()(\d{1,2})\s*(?:jours|days|business\s+days)/gi, minimum: 15 },
];
// What the sentence before a figure is about: a delivery, or a return or
// refund window ("retour sous 15 à 30 jours"), which says nothing.
const DELIVERY_CONTEXT = /livr|exp[ée]di|achemin|transit|r[ée]ception|colis|deliver|ship/gi;
const RETURN_CONTEXT = /retour|rembours|r[ée]tractation|garantie|[ée]change|return|refund|warranty/gi;
const CONTEXT_LOOKBACK = 150;
// A delay the shop explains by making the piece or by how it is carried:
// a genuine maker or furniture shop, not a supplier abroad. "Fabriqué en
// Chine" is no explanation, so making is only an excuse when done on order.
const EXPLAINED_DELAY = new RegExp([
  String.raw`d[ée]lais?\s+de\s+(?:fabrication|confection|r[ée]alisation)`,
  String.raw`(?:fabriqu|r[ée]alis|confectionn|produit)[\wÀ-ÿ]*\s+(?:sur|[àa]\s+la)\s+(?:commande|demande)`,
  String.raw`fabrication\s+(?:sur|[àa]\s+la)\s+(?:commande|demande)`,
  String.raw`sur[-\s]mesure|fait\s+main|made\s+to\s+order|custom[-\s]made|handmade`,
  String.raw`(?:transporteur|courrier|messagerie)s?\s+sp[ée]cialis[ée]s?`,
  String.raw`pr[ée]avis\s+t[ée]l[ée]phonique|prise\s+de\s+rendez-vous|white[-\s]glove`,
  // Ordered from the maker when not in stock, as designer furniture is.
  String.raw`(?:non|pas)\s+disponibles?\s+en\s+stock|hors\s+stock|not\s+in\s+stock|backorder`,
  String.raw`fabricant|manufacturer|entreprise\s+de\s+production`,
].join('|'), 'i');
const EXPLANATION_LOOKBACK = 400;
const EXPLANATION_LOOKAHEAD = 200;

/**
 * The first long delivery time the text announces ("2 à 4 semaines",
 * "jusqu'à 5 semaines", "15-25 business days"), as written, or null. Asian
 * suppliers' shipping takes weeks; a French stockist ships in days. A delay
 * the shop explains by making on order or by a specialised carrier doesn't
 * count.
 */
export function findLongDelivery(text) {
  const found = [];
  for (const { pattern, minimum } of DELIVERY_TIMES) {
    for (const match of text.matchAll(pattern)) {
      if (Number(match[2]) < minimum || !aboutDelivery(text, match.index) || explainedDelay(text, match.index)) continue;
      found.push(match);
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found[0]?.[0].replace(/\s+/g, ' ').trim() ?? null;
}

function explainedDelay(text, index) {
  return EXPLAINED_DELAY.test(text.slice(Math.max(index - EXPLANATION_LOOKBACK, 0), index + EXPLANATION_LOOKAHEAD));
}

function aboutDelivery(text, index) {
  const before = text.slice(Math.max(index - CONTEXT_LOOKBACK, 0), index);
  const last = (regex) => Math.max(-1, ...[...before.matchAll(regex)].map((m) => m.index));
  const delivery = last(DELIVERY_CONTEXT);
  return delivery >= 0 && delivery > last(RETURN_CONTEXT);
}

// "Your items may be shipped separately, from different warehouses": the
// order is split between suppliers.
const SPLIT_SHIPMENTS = /(?:envoy|exp[ée]di)[ée]e?s\s+s[ée]par[ée]ment|en\s+plusieurs\s+colis|(?:diff[ée]rents|plusieurs)\s+entrep[ôo]ts|shipped\s+separately|(?:multiple|separate)\s+(?:packages|parcels|shipments)/i;

const SHIPPING_LINK_TEXT = /livraison|exp[ée]dition|shipping|delivery/i;
const SHIPPING_PATH = /\/(?:policies\/shipping-policy|pages\/[\w-]*(?:livraison|expedition|shipping|delivery)[\w-]*)(?:[/?#]|$)/i;
// Without a shipping page, the FAQ is where shops explain delivery.
const FAQ_LINK_TEXT = /\bfaqs?\b|questions?\s+fr[ée]quentes|^\s*(?:aide|help|centre\s+d['’]aide|help\s+cent(?:er|re))\s*$/i;
const FAQ_PATH = /\/(?:pages\/)?[\w-]*(?:faqs?|questions-frequentes|aide|help)(?:[/?#.]|$)/i;
// A product or a category whose name mentions delivery ("Livraison express"
// collection) is not a policy.
const NOT_A_POLICY_PATH = /\/(?:products?|collections?|produit|categorie|category|cart|panier)\//i;

/**
 * The site's own page about delivery, or null: Shopify's
 * /policies/shipping-policy, a link whose text names delivery, or else the
 * FAQ or help page.
 * @param {Array<{text: string, href: string}>} links
 * @param {string} siteDomain
 */
export function findShippingInfoLink(links, siteDomain) {
  const candidates = [];
  for (const link of links) {
    let url;
    try {
      url = new URL(link.href);
    } catch {
      continue;
    }
    if (!hostnameMatchesDomain(url.hostname.toLowerCase(), siteDomain) || NOT_A_POLICY_PATH.test(url.pathname)) continue;
    if (SHIPPING_PATH.test(url.pathname)) candidates.push({ href: url.href, priority: 0 });
    else if (SHIPPING_LINK_TEXT.test(link.text || '')) candidates.push({ href: url.href, priority: 1 });
    else if (FAQ_PATH.test(url.pathname) || FAQ_LINK_TEXT.test(link.text || '')) candidates.push({ href: url.href, priority: 2 });
  }
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0]?.href ?? null;
}

/**
 * The clues to show, or an empty list when they don't add up to a likely
 * dropshipping shop. A virtual office, a seller in Asia or the shop saying
 * it ships from Asia is enough on its own; long delivery times and split
 * parcels take both: either alone is common at a genuine shop (designer
 * furniture often takes weeks, made to order or carried by a specialised
 * courier, as at myareadesign.com). A company number says nothing either
 * way: many dropshipping shops are French sole traders.
 * @param {Array<ReturnType<typeof findDropshippingClues> | null | undefined>} sources
 *   clues from the legal pages and the shipping policy or FAQ
 * @returns {Array<{ id: 'virtual-office'|'asian-seller'|'ships-from-asia'|'long-delivery'|'split-shipments', detail: string|null }>}
 */
export function assessDropshipping(sources) {
  const pick = (key) => sources.map((source) => source?.[key]).find(Boolean) ?? null;
  const strong = [
    pick('virtualOffice') && { id: 'virtual-office', detail: pick('virtualOffice') },
    pick('sellerPlace') && { id: 'asian-seller', detail: pick('sellerPlace') },
    pick('shipsFromAsia') && { id: 'ships-from-asia', detail: pick('shipsFromAsia') },
  ].filter(Boolean);
  const weak = [
    pick('longDelivery') && { id: 'long-delivery', detail: pick('longDelivery') },
    pick('splitShipments') && { id: 'split-shipments', detail: null },
  ].filter(Boolean);
  const likely = strong.length > 0 || weak.length >= 2;
  return likely ? [...strong, ...weak] : [];
}
