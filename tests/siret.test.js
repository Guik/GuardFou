import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSirenOrSiret,
  isValidSiren,
  isValidSiret,
  isValidSirenOrSiret,
  companyNameMatchesClaim,
  extractPublisherStatements,
} from '../src/core/siret.js';

// Real, verified SIREN/SIRET for Chausson Matériaux (checked live against
// recherche-entreprises.api.gouv.fr).
const REAL_SIREN = '528648892';
const REAL_SIRET = '52864889203671';

test('extractSirenOrSiret finds a labeled SIRET', () => {
  const result = extractSirenOrSiret('Notre entreprise. SIRET : 528 648 892 03671. Contact...');
  assert.deepEqual(result, { type: 'siret', digits: REAL_SIRET });
});

test('extractSirenOrSiret finds a labeled SIREN', () => {
  const result = extractSirenOrSiret('SIREN: 528648892 - toutes les informations légales.');
  assert.deepEqual(result, { type: 'siren', digits: REAL_SIREN });
});

test('extractSirenOrSiret falls back to a bare 14-digit run', () => {
  const result = extractSirenOrSiret('Immatriculée sous le numéro 528.648.892.03671 au RCS.');
  assert.deepEqual(result, { type: 'siret', digits: REAL_SIRET });
});

test('extractSirenOrSiret returns null with nothing to find', () => {
  assert.equal(extractSirenOrSiret('Mentions légales. Tous droits réservés.'), null);
});

// Real text from www.adepem.com/conditions-generales-vente — the SIREN is
// only given via the RCS registration line, with no "SIREN"/"SIRET" label
// anywhere on the page.
test('extractSirenOrSiret finds a SIREN given only via its RCS registration', () => {
  const result = extractSirenOrSiret('Immatriculation: RCS Paris B 321045395');
  assert.deepEqual(result, { type: 'siren', digits: '321045395' });
  assert.equal(isValidSiren(result.digits), true); // real, Luhn-valid number
});

test('isValidSiren/isValidSiret accept the real Chausson Matériaux numbers', () => {
  assert.equal(isValidSiren(REAL_SIREN), true);
  assert.equal(isValidSiret(REAL_SIRET), true);
});

test('isValidSiren/isValidSiret reject a fabricated sequential number', () => {
  assert.equal(isValidSiren('123456789'), false);
  assert.equal(isValidSiret('12345678900012'), false);
});

test('isValidSiren rejects the wrong length', () => {
  assert.equal(isValidSiren('12345'), false);
});

test('isValidSirenOrSiret dispatches by candidate type', () => {
  assert.equal(isValidSirenOrSiret({ type: 'siren', digits: REAL_SIREN }), true);
  assert.equal(isValidSirenOrSiret({ type: 'siret', digits: REAL_SIRET }), true);
  assert.equal(isValidSirenOrSiret({ type: 'siren', digits: '123456789' }), false);
});

test('companyNameMatchesClaim matches the real name against the Chausson clone\'s claim', () => {
  assert.equal(companyNameMatchesClaim('CHAUSSON MATERIAUX', 'Chausson Magasin — Chaussonconstruction.com'), true);
});

test('companyNameMatchesClaim flags a SIRET reused under a different name', () => {
  assert.equal(companyNameMatchesClaim('CHAUSSON MATERIAUX', 'Tommy Jeans - 90\'s Fashion Store'), false);
});

test('companyNameMatchesClaim does not penalize when there is nothing to compare', () => {
  assert.equal(companyNameMatchesClaim(null, 'some text'), true);
  assert.equal(companyNameMatchesClaim('CHAUSSON MATERIAUX', ''), true);
});

// chauffage-et-climatisation.fr's legal notice: the brand is the trading
// name of a Spanish company, whose SIRET it shows.
const TRADING_NAME_NOTICE = 'Mentions légales Le site https://www.chauffage-et-climatisation.fr/ est édité par PLANETE HOME SLU, exerçant sous l’enseigne « CHAUFFAGE ET CLIMATISATION », sise AVDA DEL PARQUE NUM 32 - 3D 99134 LUCENA – CORDOBA, société étrangère non immatriculée au RCS. L’hébergeur du site est OVH.';

test('extractPublisherStatements keeps what follows "édité par"', () => {
  const statements = extractPublisherStatements(TRADING_NAME_NOTICE);
  assert.match(statements, /^ PLANETE HOME SLU, exerçant sous/);
  assert.ok(statements.length <= 600);
  assert.equal(extractPublisherStatements('Nothing about the publisher here.'), '');
  assert.equal(extractPublisherStatements(null), '');
});

test('a company named as publisher in the legal notice matches, despite another brand name', () => {
  const claimed = 'Clim FTXP71N + RXP71N | Comfora inverter Daikin mono-split • Chauffage et climatisation';
  assert.equal(companyNameMatchesClaim('PLANETE HOME SLU', claimed), false);
  assert.equal(companyNameMatchesClaim('PLANETE HOME SLU', `${claimed} • ${extractPublisherStatements(TRADING_NAME_NOTICE)}`), true);
});
