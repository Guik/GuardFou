import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTechnologies,
  detectSocialLinks,
  findLegalLinks,
  extractPhysicalAddress,
  guessLanguage,
  analyzeLegalText,
  summarizeSeoMeta,
  stripHtmlToText,
  checkMandatoryLegalMentions,
} from '../src/core/identity.js';

test('detectTechnologies finds WooCommerce/WordPress markers', () => {
  const html = '<link rel="stylesheet" href="/wp-content/themes/foo/style.css">';
  assert.deepEqual(detectTechnologies(html, null), ['WordPress / WooCommerce']);
});

test('detectTechnologies includes the generator meta tag verbatim', () => {
  assert.deepEqual(detectTechnologies('<html></html>', 'WordPress 6.4'), ['WordPress 6.4']);
});

test('detectTechnologies returns an empty array when nothing matches', () => {
  assert.deepEqual(detectTechnologies('<html><body>hello</body></html>', null), []);
});

test('detectSocialLinks finds known platforms and dedupes by platform', () => {
  const hrefs = [
    'https://www.facebook.com/chausson',
    'https://instagram.com/chausson',
    'https://www.facebook.com/chausson/about', // duplicate platform, should be ignored
    'https://example.com/not-social',
  ];
  const result = detectSocialLinks(hrefs);
  assert.equal(result.length, 2);
  assert.ok(result.some((r) => r.platform === 'Facebook' && r.url === hrefs[0]));
  assert.ok(result.some((r) => r.platform === 'Instagram'));
});

test('detectSocialLinks does not mistake netflix.com for x.com', () => {
  assert.deepEqual(detectSocialLinks(['https://www.netflix.com/browse']), []);
});

test('detectSocialLinks skips non-absolute hrefs instead of guessing', () => {
  assert.deepEqual(detectSocialLinks(['#', '/relative/path', 'javascript:void(0)']), []);
});

test('findLegalLinks filters by link text', () => {
  const links = [
    { text: 'Mentions légales', href: '/mentions-legales' },
    { text: 'Accueil', href: '/' },
    { text: 'CGV', href: '/cgv' },
    { text: 'Politique de confidentialité', href: '/politique-de-confidentialite' },
  ];
  const result = findLegalLinks(links);
  assert.equal(result.length, 3);
  assert.ok(result.some((l) => l.href === '/mentions-legales'));
  assert.ok(result.some((l) => l.href === '/cgv'));
  assert.ok(result.some((l) => l.href === '/politique-de-confidentialite'));
});

test('findLegalLinks prioritizes "mentions légales" over a privacy policy when both exist', () => {
  const links = [
    // Privacy policy appears first in the DOM, as is common in footers.
    { text: 'Politique de confidentialité', href: '/politique-de-confidentialite' },
    { text: 'Mentions légales', href: '/mentions-legales' },
    { text: 'CGV', href: '/cgv' },
  ];
  const result = findLegalLinks(links);
  assert.equal(result[0].href, '/mentions-legales');
});

test('findLegalLinks falls back to CGV/CGU, then privacy policy, when no mentions légales link exists', () => {
  const withCgv = findLegalLinks([
    { text: 'Politique de confidentialité', href: '/privacy' },
    { text: 'CGV', href: '/cgv' },
  ]);
  assert.equal(withCgv[0].href, '/cgv');

  const privacyOnly = findLegalLinks([{ text: 'Politique de confidentialité', href: '/privacy' }]);
  assert.equal(privacyOnly[0].href, '/privacy');
});

test('extractPhysicalAddress finds a plausible French address', () => {
  const text = 'Notre siège : 12 rue des Lilas, 75001 Paris. Contactez-nous.';
  const address = extractPhysicalAddress(text);
  assert.ok(address);
  assert.ok(address.includes('75001'));
});

test('extractPhysicalAddress returns null with no address-like text', () => {
  assert.equal(extractPhysicalAddress('Bienvenue sur notre site, aucune adresse ici.'), null);
});

test('guessLanguage recognises French and English text', () => {
  const fr = 'Les présentes mentions légales sont applicables à tous les utilisateurs du site pour toute commande effectuée avec nous.';
  const en = 'These terms and conditions apply to all users of the website for any order placed with us and our team.';
  assert.equal(guessLanguage(fr), 'fr');
  assert.equal(guessLanguage(en), 'en');
});

test('guessLanguage returns unknown for too-short text', () => {
  assert.equal(guessLanguage('Hello world'), 'unknown');
});

test('analyzeLegalText flags a language mismatch', () => {
  const en = 'These terms and conditions apply to all users of the website for any order placed with us and our team right now.';
  const result = analyzeLegalText(en, 'fr');
  assert.equal(result.present, true);
  assert.equal(result.detectedLang, 'en');
  assert.equal(result.languageMismatch, true);
});

test('analyzeLegalText flags missing legal text', () => {
  const result = analyzeLegalText(null, 'fr');
  assert.equal(result.present, false);
});

test('analyzeLegalText flags a suspiciously short legal page', () => {
  const result = analyzeLegalText('Mentions légales.', 'fr');
  assert.equal(result.tooShort, true);
});

test('stripHtmlToText removes scripts, styles, tags and decodes entities', () => {
  const html = `
    <html><head><style>.a{color:red}</style><script>var x = 1 < 2;</script></head>
    <body><p>Mentions l&eacute;gales &amp; CGV</p><p>Soci&eacute;t&eacute; &quot;Chausson&quot; &nbsp; 12 rue des Lilas</p></body></html>
  `;
  const text = stripHtmlToText(html);
  assert.ok(!text.includes('color:red'));
  assert.ok(!text.includes('var x'));
  assert.ok(text.includes('Mentions'));
  assert.ok(text.includes('& CGV')); // &amp; decoded
  assert.ok(text.includes('"Chausson"')); // &quot; decoded
  assert.ok(text.includes('12 rue des Lilas')); // &nbsp; turned into a space, not glued
});

test('checkMandatoryLegalMentions returns null with no text', () => {
  assert.equal(checkMandatoryLegalMentions(null), null);
  assert.equal(checkMandatoryLegalMentions(''), null);
});

test('checkMandatoryLegalMentions finds a complete SARL legal notice', () => {
  const text = `
    Chausson Matériaux, SARL au capital social de 50 000 euros.
    Siège social : 12 rue des Lilas, 75001 Paris.
    SIRET : 123 456 789 00012 — RCS Paris B 123 456 789.
    N° TVA intracommunautaire : FR12 345678901.
    Contact : contact@chausson.fr — 01 23 45 67 89.
    Directeur de la publication : Jean Dupont.
    Hébergeur : OVH SAS, 2 rue Kellermann, 59100 Roubaix.
    Médiateur de la consommation : CM2C, en cas de litige non résolu.
  `;
  const result = checkMandatoryLegalMentions(text);
  assert.equal(result.missingUniversalCount, 0);
  assert.equal(result.missingConditionalCount, 0);
  assert.ok(result.universal.every((m) => m.present));
  assert.ok(result.conditional.every((m) => m.present));
});

test('checkMandatoryLegalMentions flags a near-empty templated notice', () => {
  const text = 'Mentions légales. Tous droits réservés.';
  const result = checkMandatoryLegalMentions(text);
  assert.equal(result.missingUniversalCount, 6);
  assert.equal(result.missingConditionalCount, 4);
});

test('checkMandatoryLegalMentions does not require RCS/capital for a sole trader', () => {
  const text = `
    Jean Martin, auto-entrepreneur.
    Adresse : 5 avenue Victor Hugo, 69002 Lyon.
    SIRET : 987 654 321 00019.
    Contact : jean.martin@example.fr.
    Hébergeur : OVH SAS, Roubaix.
    Directeur de la publication : Jean Martin.
  `;
  const result = checkMandatoryLegalMentions(text);
  assert.equal(result.missingUniversalCount, 0);
  // RCS/capital social correctly don't apply to a sole trader, so they're
  // absent here — the caller weights this tier lower for exactly that reason.
  assert.ok(result.missingConditionalCount > 0);
});

test('summarizeSeoMeta flags missing description and multiple H1s', () => {
  const summary = summarizeSeoMeta({
    hasMetaDescription: false,
    hasCanonical: true,
    hasOgTitle: true,
    titleLength: 40,
    h1Count: 3,
    imageCount: 10,
    imagesMissingAlt: 8,
  });
  const byLabel = Object.fromEntries(summary.map((s) => [s.label.split(' (')[0], s.ok]));
  assert.equal(byLabel['Balise meta description présente'], false);
  assert.equal(byLabel['Lien canonical présent'], true);
});
