import './helpers/i18n.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, findPrices, summarizePriceCuts, hasSteepDiscounts } from '../src/core/prices.js';
import { computeScore } from '../src/core/scoring.js';

test('amounts are read in French and English notations', () => {
  assert.equal(parseAmount('2.448,00'), 2448);
  assert.equal(parseAmount('2,448.00'), 2448);
  assert.equal(parseAmount('2 448,00'), 2448);
  assert.equal(parseAmount('489,60'), 489.6);
  assert.equal(parseAmount('1,299'), 1299);
  assert.equal(parseAmount('49.9'), 49.9);
});

test('only amounts with a currency are prices', () => {
  assert.deepEqual(findPrices('Le prix initial était : €2.448,00. 489,60 € — 3 avis, -80 %'), [2448, 489.6]);
  assert.deepEqual(findPrices('Livraison en 3 à 5 jours'), []);
});

// From a product of bestmobilierdesign.com (2026-11-27), WooCommerce markup:
// the text around the struck price repeats it for screen readers.
const COSTANTINA = { was: '€2.448,00', now: '€489,60' };
const COSTANTINA_AROUND = { was: '€2.448,00', now: 'Le prix initial était : €2.448,00. €489,60 Le prix actuel est : €489,60.' };

test('the price paid is the lowest amount under the struck one', () => {
  assert.deepEqual(summarizePriceCuts([COSTANTINA_AROUND]), { count: 1, steepCount: 1, maxPercent: 80 });
  assert.deepEqual(summarizePriceCuts([{ was: 'ancien modèle', now: '12 €' }, { was: '20 €', now: '25 €' }]).count, 0);
});

test('a product shown twice counts once', () => {
  assert.equal(summarizePriceCuts([COSTANTINA, COSTANTINA_AROUND]).count, 1);
});

test('most products cut by half or more is steep, a few or a normal sale is not', () => {
  const cuts = [COSTANTINA, { was: '1 290 €', now: '349 €' }, { was: '890 €', now: '199 €' }];
  assert.equal(hasSteepDiscounts(summarizePriceCuts(cuts)), true);
  assert.equal(hasSteepDiscounts(summarizePriceCuts(cuts.slice(0, 2))), false);
  const sale = [{ was: '100 €', now: '80 €' }, { was: '60 €', now: '45 €' }, { was: '200 €', now: '90 €' }];
  assert.equal(hasSteepDiscounts(summarizePriceCuts(sale)), false);
});

test('steep discounts only count in the domain’s first year', () => {
  const ids = (signals) => computeScore(signals).reasons.map((r) => r.id);
  const steepDiscounts = { maxPercent: 80 };
  assert.ok(ids({ steepDiscounts, domainAgeDays: 200 }).includes('steep-discounts-recent-domain'));
  assert.ok(!ids({ steepDiscounts, domainAgeDays: 400 }).includes('steep-discounts-recent-domain'));
  assert.ok(!ids({ steepDiscounts, domainAgeDays: null }).includes('steep-discounts-recent-domain'));
  assert.match(computeScore({ steepDiscounts, domainAgeDays: 200 }).reasons.find((r) => r.id === 'steep-discounts-recent-domain').message, /80/);
});
