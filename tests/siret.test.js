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
// yesassurances.fr's legal notice (Nov 2026): the host's SIRET comes first.
const HOST_FIRST_NOTICE = 'Les Agents AXA sont régis par le code des assurances. – Informations Générales Hébergeur : 1&1 Internet SARL 7, place de la Gare, BP 70109, 57201 Sarreguemines Cedex RCS Sarreguemines B : 431 303 775 SIRET : 431 303 775 000 16 CNIL : 8 rue Vivienne 75083 PARIS Cedex 02 Tél : 01 53 73 22 22 N° d’enregistrement : 1838567. Auteur, Directeur de la publication, Concepteur, Réalisateur, Editeur : Stephan CHARRIER Agent général d’assurance AXA 94 avenue de la République 44600 St Nazaire www.yesassurances.fr N°ORIAS :14005665 N°SIRET : 804 471 142 00021 Agent Général d’assurance.';

test('extractSirenOrSiret skips the host\'s SIRET for the publisher\'s', () => {
  assert.deepEqual(extractSirenOrSiret(HOST_FIRST_NOTICE), { type: 'siret', digits: '80447114200021' });
});

test('extractSirenOrSiret still uses the host\'s number when it is the only one', () => {
  assert.deepEqual(extractSirenOrSiret('Hébergeur : OVH SAS, RCS Lille 424 761 419, SIRET : 424 761 419 00045.'), { type: 'siret', digits: '42476141900045' });
});

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
  assert.ok(statements.length <= 900);
  assert.equal(extractPublisherStatements('Nothing about the publisher here.'), '');
  assert.equal(extractPublisherStatements(null), '');
});

test('extractPublisherStatements reads other wordings and the name before a company number', () => {
  const ownedBy = 'Le site lesfurets.com est la propriété de La Centrale de Financement, société par actions simplifiée.';
  assert.match(extractPublisherStatements(ownedBy), /La Centrale de Financement/);
  const beforeNumber = 'Mentions légales. LCF - La Centrale de Financement, SAS au capital de 1 000 000 €, RCS Paris 123 456 789. Hébergeur : AWS.';
  assert.equal(companyNameMatchesClaim('LA CENTRALE DE FINANCEMENT (LCF)', `LesFurets • ${extractPublisherStatements(beforeNumber)}`), true);
  // A notice that names another company before the number still mismatches.
  const reused = 'Boutique Mode Paris, SAS au capital de 1 000 €, RCS Paris 123 456 789.';
  assert.equal(companyNameMatchesClaim('LA CENTRALE DE FINANCEMENT (LCF)', `Boutique Mode • ${extractPublisherStatements(reused)}`), false);
});

test('a company named as publisher in the legal notice matches, despite another brand name', () => {
  const claimed = 'Clim FTXP71N + RXP71N | Comfora inverter Daikin mono-split • Chauffage et climatisation';
  assert.equal(companyNameMatchesClaim('PLANETE HOME SLU', claimed), false);
  assert.equal(companyNameMatchesClaim('PLANETE HOME SLU', `${claimed} • ${extractPublisherStatements(TRADING_NAME_NOTICE)}`), true);
});
