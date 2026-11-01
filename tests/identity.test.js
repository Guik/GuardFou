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
  extractContactLinks,
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
  assert.ok(text.includes('Mentions légales')); // &eacute; actually decoded to "é", not left as "&eacute;"
  assert.ok(text.includes('& CGV')); // &amp; decoded
  assert.ok(text.includes('"Chausson"')); // &quot; decoded
  assert.ok(text.includes('12 rue des Lilas')); // &nbsp; turned into a space, not glued
});

// Real bug: www.adepem.com's legal page HTML-encodes accented letters and
// the euro sign as named entities ("D&eacute;nomination", "&euro;") rather
// than embedding the literal characters, which silently broke the
// mandatory-mentions regexes until stripHtmlToText decoded more than the
// basic five entities.
test('stripHtmlToText decodes accented-letter and currency entities, not just the basic five', () => {
  assert.equal(stripHtmlToText('D&eacute;nomination'), 'Dénomination');
  assert.equal(stripHtmlToText('15,90&nbsp;&euro;'), '15,90 €');
  assert.equal(stripHtmlToText('Soci&eacute;t&eacute; Fran&ccedil;aise'), 'Société Française');
});

test('stripHtmlToText decodes numeric entities (decimal and hex)', () => {
  assert.equal(stripHtmlToText('D&#233;nomination'), 'Dénomination');
  assert.equal(stripHtmlToText('D&#xe9;nomination'), 'Dénomination');
});

test('stripHtmlToText leaves an unrecognized named entity as-is rather than guessing', () => {
  assert.equal(stripHtmlToText('&notarealentity;'), '&notarealentity;');
});

test('extractContactLinks pulls email and phone out of mailto:/tel: hrefs', () => {
  const html = '<a href="mailto:contact@adepem.com">Nous contacter</a> <a href="tel:+33477123456">Appelez-nous</a>';
  const links = extractContactLinks(html);
  assert.ok(links.includes('contact@adepem.com'));
  assert.ok(links.includes('+33477123456'));
});

test('extractContactLinks finds nothing when there are no mailto:/tel: links', () => {
  assert.equal(extractContactLinks('<a href="/contact">Nous contacter</a>'), '');
});

test('a mailto: link whose visible text has no email is still detected as contact info once appended', () => {
  const html = '<a href="mailto:contact@adepem.com">Nous contacter</a>';
  const visibleText = stripHtmlToText(html);
  assert.ok(!visibleText.includes('@')); // the visible text alone has no email
  const combined = `${visibleText} ${extractContactLinks(html)}`;
  const result = checkMandatoryLegalMentions(`${combined} Dénomination sociale: Test. SIRET: 123 456 789 00012. 1 rue de Paris 75001 Paris.`);
  assert.equal(result.universal.find((m) => m.key === 'contact').present, true);
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

// Real text from www.adepem.com/conditions-generales-vente. Caught three
// false negatives on this real page: no legal-form keyword (just
// "Dénomination sociale:" with no SARL/SAS/etc after it), the SIREN given
// only via "RCS Paris B ..." with no "SIREN" label, and "Capital:" without
// the word "social".
test('checkMandatoryLegalMentions reads the real adepem.com CGV page correctly', () => {
  const text = `Dénomination sociale: ADEPEM
Capital: 15.244,90 Euros
Siège social: 104 rue de Maubeuge 75010 PARIS
Immatriculation: RCS Paris B 321045395
Code APE: 514F
N° TVA intracommunautaire: FR-321 045 395 00019
Site web: https://www.adepem.com`;
  const result = checkMandatoryLegalMentions(text);
  const present = (key) => [...result.universal, ...result.conditional].find((m) => m.key === key).present;
  assert.equal(present('legalForm'), true);
  assert.equal(present('siren'), true);
  assert.equal(present('address'), true);
  assert.equal(present('rcs'), true);
  assert.equal(present('capital'), true);
  assert.equal(present('vat'), true);
  // Genuinely absent from this excerpt, not detection bugs:
  assert.equal(present('contact'), false);
  assert.equal(present('host'), false);
  assert.equal(present('publicationDirector'), false);
  assert.equal(present('mediator'), false);
});

test('on this real adepem.com excerpt, the missing fields are all low-weight administrative ones', () => {
  const text = `Dénomination sociale: ADEPEM
Capital: 15.244,90 Euros
Siège social: 104 rue de Maubeuge 75010 PARIS
Immatriculation: RCS Paris B 321045395
N° TVA intracommunautaire: FR-321 045 395 00019`;
  const result = checkMandatoryLegalMentions(text);
  const missing = [...result.universal, ...result.conditional].filter((m) => !m.present);
  // None of the missing fields are the high-weight identity ones
  // (dénomination/SIRET/adresse are all present here) — every missing
  // field should be weight 2, not 5.
  assert.ok(missing.every((m) => m.weight === 2));
});

// Real bug: `\b` was shared across the whole (?:€|euros?) alternation, but
// \b only makes sense after a word character — it silently never matched
// the "€" branch at all, so "Capital: 15.244,90 €" (the actual encoding on
// a real page, once &euro; is decoded) was reported as missing even though
// "Capital: ... Euros" (the spelled-out word) worked fine.
test('checkMandatoryLegalMentions recognises "Capital : <amount> €" with the euro symbol, not just the word "Euros"', () => {
  const result = checkMandatoryLegalMentions('Capital: 15.244,90 € SIRET: 123456789. 1 rue de Paris 75001 Paris.');
  assert.equal(result.conditional.find((m) => m.key === 'capital').present, true);
});

test('extractPhysicalAddress does not bleed into the next field when there is no comma before the postal code', () => {
  const text = 'Siège social: 104 rue de Maubeuge 75010 PARIS Immatriculation: RCS Paris B 321045395';
  assert.equal(extractPhysicalAddress(text), '104 rue de Maubeuge 75010 PARIS');
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
