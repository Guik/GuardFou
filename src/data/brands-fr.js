/**
 * Known French brands and their official domains, used to catch sites that
 * present themselves as a brand without being one of its real domains
 * (e.g. "chaussonconstruction.com" claiming to be "Chausson"). Retailers,
 * plus the windshield, energy and insurance names that scam sites for home
 * services borrow. List every domain a brand really uses, group sites
 * included, or its own sites get flagged.
 *
 * Each entry has:
 * - name, aliases: the names a page may use for itself (matching ignores
 *   case and accents).
 * - officialDomains: every domain the brand really uses.
 * - sector: one of SECTORS below.
 * - source: short English reason the brand is on the list.
 * - verified: ISO date (YYYY-MM-DD) the officialDomains were last checked.
 * - commonWord (optional, true only when a single-word alias is an ordinary
 *   word): look-alike checks use only the brand's multi-word aliases and
 *   never flag a near-miss spelling. A page that names itself as the brand
 *   is still caught. "Boulanger" is a common word, so "boulangershop.fr" and
 *   "boulanger-direct.fr" (a bakery) are not flagged.
 *
 * tests/brands.test.js enforces these fields and the commonWord rule.
 */

export const SECTORS = ['diy', 'electronics', 'sport', 'marketplace', 'windshield', 'energy', 'insurance'];

export const BRANDS_FR = [
  // "chausson" is an ordinary word (slipper, pastry), so this brand is not
  // commonWord: it is the founding confirmed clone case and is caught by its
  // domain (chaussonconstruction.com), which needs single-word matching.
  { name: 'Chausson Matériaux', aliases: ['chausson materiaux', 'chausson'], officialDomains: ['chausson.fr'], sector: 'diy', source: 'Confirmed clone chaussonconstruction.com, Oct 2026', verified: '2026-11-17' },
  { name: 'Leroy Merlin', aliases: ['leroy merlin', 'leroymerlin'], officialDomains: ['leroymerlin.fr'], sector: 'diy', source: 'Large French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Castorama', aliases: ['castorama'], officialDomains: ['castorama.fr'], sector: 'diy', source: 'Large French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Brico Dépôt', aliases: ['brico depot', 'bricodepot'], officialDomains: ['bricodepot.fr'], sector: 'diy', source: 'Large French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Point.P', aliases: ['point p', 'pointp'], officialDomains: ['pointp.fr'], sector: 'diy', source: 'Large French building-supplies chain (initial list)', verified: '2026-11-17' },
  { name: 'Gedimat', aliases: ['gedimat'], officialDomains: ['gedimat.fr'], sector: 'diy', source: 'French building-materials chain (initial list)', verified: '2026-11-17' },
  { name: 'Weldom', aliases: ['weldom'], officialDomains: ['weldom.fr'], sector: 'diy', source: 'French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Mr Bricolage', aliases: ['mr bricolage', 'mr. bricolage'], officialDomains: ['mr-bricolage.fr'], sector: 'diy', source: 'French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Fnac', aliases: ['fnac'], officialDomains: ['fnac.com'], sector: 'electronics', source: 'Large French electronics and culture retailer (initial list)', verified: '2026-11-17' },
  { name: 'Darty', aliases: ['darty'], officialDomains: ['darty.com'], sector: 'electronics', source: 'Large French electronics retailer (initial list)', verified: '2026-11-17' },
  { name: 'Decathlon', aliases: ['decathlon'], officialDomains: ['decathlon.fr', 'decathlon.com'], sector: 'sport', source: 'Large French sports retailer (initial list)', verified: '2026-11-17' },
  { name: 'Boulanger', aliases: ['boulanger'], officialDomains: ['boulanger.com'], sector: 'electronics', source: 'Large French electronics retailer (initial list)', verified: '2026-11-17', commonWord: true },
  { name: 'Cdiscount', aliases: ['cdiscount'], officialDomains: ['cdiscount.com'], sector: 'marketplace', source: 'Large French online marketplace (initial list)', verified: '2026-11-17' },
  { name: 'Manomano', aliases: ['manomano'], officialDomains: ['manomano.fr', 'manomano.com'], sector: 'marketplace', source: 'French online marketplace for DIY and garden (initial list)', verified: '2026-11-17' },

  // Windshield repair
  { name: 'Carglass', aliases: ['carglass'], officialDomains: ['carglass.fr'], sector: 'windshield', source: 'Name borrowed by home-service scams (windshield)', verified: '2026-11-17' },
  { name: 'France Pare-Brise', aliases: ['france pare brise', 'franceparebrise'], officialDomains: ['franceparebrise.fr'], sector: 'windshield', source: 'Name borrowed by home-service scams (windshield)', verified: '2026-11-17' },
  { name: 'Mondial Pare-Brise', aliases: ['mondial pare brise', 'mondialparebrise'], officialDomains: ['mondialparebrise.fr'], sector: 'windshield', source: 'Name borrowed by home-service scams (windshield)', verified: '2026-11-17' },

  // Energy
  { name: 'EDF', aliases: ['edf'], officialDomains: ['edf.fr', 'edf.com', 'edfenr.com', 'edf-solutions-solaires.com'], sector: 'energy', source: 'Name borrowed by home-service scams (energy)', verified: '2026-11-17' },
  { name: 'Engie', aliases: ['engie'], officialDomains: ['engie.fr', 'engie.com'], sector: 'energy', source: 'Name borrowed by home-service scams (energy)', verified: '2026-11-17' },
  { name: 'TotalEnergies', aliases: ['totalenergies', 'total energies'], officialDomains: ['totalenergies.fr', 'totalenergies.com'], sector: 'energy', source: 'Name borrowed by home-service scams (energy)', verified: '2026-11-17' },

  // Insurance. allianzdirect.fr now lands on Luko ("Luko by Allianz Direct"),
  // so luko.eu is an Allianz domain too.
  { name: 'AXA', aliases: ['axa'], officialDomains: ['axa.fr', 'axa.com'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'Allianz', aliases: ['allianz'], officialDomains: ['allianz.fr', 'allianz.com', 'allianzdirect.fr', 'allianzdirect.com', 'allianzdirect.de', 'allianzdirect.nl', 'allianzdirect.es', 'allianzdirect.it', 'luko.eu'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'Groupama', aliases: ['groupama'], officialDomains: ['groupama.fr', 'groupama.com'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'MAIF', aliases: ['maif'], officialDomains: ['maif.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'Macif', aliases: ['macif'], officialDomains: ['macif.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'MAAF', aliases: ['maaf'], officialDomains: ['maaf.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'Matmut', aliases: ['matmut'], officialDomains: ['matmut.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'GMF', aliases: ['gmf'], officialDomains: ['gmf.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
];
