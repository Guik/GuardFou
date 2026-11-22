import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findDropshippingClues,
  findAsianSellerPlace,
  findLongDelivery,
  findShipsFromAsia,
  findShippingInfoLink,
  assessDropshipping,
} from '../src/core/dropshipping.js';

// From mario-boutique.fr's legal notice (2026-11-22).
const MARIO_LEGAL = `Propriétaire : Mario Boutique – Capital social de 5000€ – 87-105 Chatham Road,
  Flat/RM 9 4/F, Beverley Commercial Centre, Tsim Sha Tsui, Kowloon, Hong Kong, 122001
  Hébergeur : Shopify – 151 O'Connor Street Ground Floor K2P 2L8 Ottawa`;
const COUNTRY_SELECTOR = 'Pays-Bas EUR € Pologne EUR € Portugal EUR € R.A.S. chinoise de Hong Kong EUR € Roumanie EUR €';

test('a known dropshipping registered office and a Hong Kong seller are found', () => {
  const clues = findDropshippingClues(MARIO_LEGAL);
  assert.equal(clues.virtualOffice, 'Beverley Commercial Centre, Kowloon');
  assert.equal(clues.sellerPlace, 'Hong Kong');
});

test('a shop’s country selector is not a seller address', () => {
  assert.equal(findAsianSellerPlace(COUNTRY_SELECTOR), null);
  assert.equal(findAsianSellerPlace('Livraison vers la Chine, Hong Kong et Taïwan.'), null);
});

test('a place in the host’s section is not the seller’s', () => {
  assert.equal(findAsianSellerPlace('Éditeur : Exemple SAS, 12 rue des Lilas, Paris. Hébergeur : Alibaba Cloud, building 5, Hangzhou, Zhejiang'), null);
  assert.equal(findAsianSellerPlace('Siège social : Room 1203, Futian district, Shenzhen, Guangdong'), 'Shenzhen');
});

test('long delivery times are found, normal ones are not', () => {
  assert.equal(findLongDelivery('la livraison peut aller jusqu’à 2 à 4 semaines en cette période'), '2 à 4 semaines');
  assert.equal(findLongDelivery('La durée de livraison peut aller jusqu’à 5 semaines'), 'jusqu’à 5 semaines');
  assert.equal(findLongDelivery('Shipping takes 15-25 business days'), '15-25 business days');
  assert.equal(findLongDelivery('Livraison en 3 à 5 jours ouvrés'), null);
  assert.equal(findLongDelivery('Livraison en 1 à 2 semaines'), null);
});

test('a return or refund window is not a delivery time', () => {
  assert.equal(findLongDelivery('Après la livraison, vous disposez d’un droit de retour sous 15 à 30 jours'), null);
  assert.equal(findLongDelivery('Le remboursement intervient sous 2 à 4 semaines'), null);
});

test('a shop saying it ships from Asia is found', () => {
  // From warmlydecor.com's FAQ (2026-11-22).
  assert.equal(findShipsFromAsia('This means that your order is shipped from global areas such as Thailand, Tibet, China, India, etc.'), 'shipped from global areas such as Thailand, Tibet, China');
  assert.equal(findShipsFromAsia('Vos articles sont expédiés directement depuis nos entrepôts en Chine.'), 'expédiés directement depuis nos entrepôts en Chine');
  assert.equal(findShipsFromAsia('Nos entrepôts sont situés en Chine et en Europe.'), 'entrepôts sont situés en Chine');
  assert.equal(findShipsFromAsia('Our suppliers are based in Shenzhen.'), 'suppliers are based in Shenzhen');
});

test('a product made in Asia, a destination or a denial is not shipping from Asia', () => {
  assert.equal(findShipsFromAsia('Fabriqué en Chine. Livraison en 48 h depuis notre entrepôt de Lyon.'), null);
  assert.equal(findShipsFromAsia('We ship from our Paris warehouse to Europe and Asia.'), null);
  assert.equal(findShipsFromAsia('Livraison de vos colis partout, y compris en Asie.'), null);
  assert.equal(findShipsFromAsia("We don't ship from China: everything leaves our Lyon warehouse."), null);
  assert.equal(findShipsFromAsia("Nous n'expédions jamais depuis la Chine."), null);
});

test('split parcels are found', () => {
  assert.equal(findDropshippingClues('il est possible que ceux-ci soient envoyés séparément, en fonction des stocks').splitShipments, true);
  assert.equal(findDropshippingClues('Your items may be shipped separately.').splitShipments, true);
  assert.equal(findDropshippingClues('Livraison offerte dès 50 €').splitShipments, false);
});

test('the shipping policy link is the site’s own, not a product or another site', () => {
  const links = [
    { text: 'Livraison express', href: 'https://shop.fr/collections/livraison-express' },
    { text: 'Livraison', href: 'https://transporteur.com/livraison' },
    { text: 'Politique de livraison', href: 'https://shop.fr/pages/politique-de-livraison' },
  ];
  assert.equal(findShippingInfoLink(links, 'shop.fr'), 'https://shop.fr/pages/politique-de-livraison');
  assert.equal(findShippingInfoLink([{ text: 'Shipping', href: 'https://shop.fr/policies/shipping-policy' }], 'shop.fr'), 'https://shop.fr/policies/shipping-policy');
  assert.equal(findShippingInfoLink([{ text: 'Accueil', href: 'https://shop.fr/' }], 'shop.fr'), null);
});

test('without a shipping page, the FAQ or help page is read', () => {
  const faq = { text: 'FAQs', href: 'https://shop.com/pages/faqs' };
  assert.equal(findShippingInfoLink([{ text: 'Contact', href: 'https://shop.com/pages/contact-us' }, faq], 'shop.com'), faq.href);
  assert.equal(findShippingInfoLink([faq, { text: 'Livraison', href: 'https://shop.com/pages/livraison' }], 'shop.com'), 'https://shop.com/pages/livraison');
  assert.equal(findShippingInfoLink([{ text: 'Questions fréquentes', href: 'https://shop.fr/questions' }], 'shop.fr'), 'https://shop.fr/questions');
  assert.equal(findShippingInfoLink([{ text: 'Aide', href: 'https://shop.fr/aide' }], 'shop.fr'), 'https://shop.fr/aide');
  assert.equal(findShippingInfoLink([{ text: 'Aide', href: 'https://help.zendesk.com/shop' }], 'shop.fr'), null);
});

test('a shop saying it ships from Asia is a strong clue', () => {
  const none = findDropshippingClues(null);
  const clues = assessDropshipping([none, { ...none, shipsFromAsia: 'shipped from China' }], { hasCompanyNumber: true });
  assert.deepEqual(clues, [{ id: 'ships-from-asia', detail: 'shipped from China' }]);
});

test('a strong clue is enough, a weak one needs a second one or no company number', () => {
  const none = findDropshippingClues(null);
  const ids = (clues) => clues.map((clue) => clue.id);
  assert.deepEqual(ids(assessDropshipping([findDropshippingClues(MARIO_LEGAL)], { hasCompanyNumber: false })), ['virtual-office', 'asian-seller']);
  assert.deepEqual(ids(assessDropshipping([none, { ...none, longDelivery: '4 à 6 semaines' }], { hasCompanyNumber: true })), []);
  assert.deepEqual(ids(assessDropshipping([none, { ...none, longDelivery: '4 à 6 semaines' }], { hasCompanyNumber: false })), ['long-delivery']);
  assert.deepEqual(ids(assessDropshipping([{ ...none, splitShipments: true }, { ...none, longDelivery: '2 à 4 semaines' }], { hasCompanyNumber: true })), ['long-delivery', 'split-shipments']);
  assert.deepEqual(assessDropshipping([null, null], { hasCompanyNumber: false }), []);
});
