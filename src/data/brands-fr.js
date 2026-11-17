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
 * - exactAliases (optional): aliases that only count when they are a whole
 *   part of the site's name ("La Poste", "La Poste | Suivi"), not words
 *   inside a longer one ("Hôtel de la Poste"). For brand names that many
 *   unrelated businesses also carry.
 *
 * tests/brands.test.js enforces these fields and the commonWord rule.
 */

export const SECTORS = ['diy', 'electronics', 'sport', 'marketplace', 'windshield', 'energy', 'insurance', 'delivery', 'government'];

export const BRANDS_FR = [
  // "chausson" is an ordinary word (slipper, pastry), so this brand is not
  // commonWord: it is the founding confirmed clone case and is caught by its
  // domain (chaussonconstruction.com), which needs single-word matching.
  { name: 'Chausson Matériaux', aliases: ['chausson materiaux', 'chausson'], officialDomains: ['chausson.fr', 'chausson-materiaux.fr'], sector: 'diy', source: 'Confirmed clone chaussonconstruction.com, Oct 2026', verified: '2026-11-17' },
  { name: 'Leroy Merlin', aliases: ['leroy merlin', 'leroymerlin'], officialDomains: ['leroymerlin.fr'], sector: 'diy', source: 'Large French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Castorama', aliases: ['castorama'], officialDomains: ['castorama.fr', 'castorama.com', 'castorama.net', 'castorama.org', 'castorama.eu', 'castorama.info'], sector: 'diy', source: 'Large French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Brico Dépôt', aliases: ['brico depot', 'bricodepot'], officialDomains: ['bricodepot.fr', 'bricodepot.com', 'brico-depot.fr', 'brico-depot.net', 'brico-depot.info', 'bricodepot.net', 'bricodepot.info', 'brico-depot.com'], sector: 'diy', source: 'Large French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Point.P', aliases: ['point p', 'pointp'], officialDomains: ['pointp.fr'], sector: 'diy', source: 'Large French building-supplies chain (initial list)', verified: '2026-11-17' },
  { name: 'Gedimat', aliases: ['gedimat'], officialDomains: ['gedimat.fr'], sector: 'diy', source: 'French building-materials chain (initial list)', verified: '2026-11-17' },
  { name: 'Weldom', aliases: ['weldom'], officialDomains: ['weldom.fr'], sector: 'diy', source: 'French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Mr Bricolage', aliases: ['mr bricolage', 'mr. bricolage'], officialDomains: ['mr-bricolage.fr', 'mrbricolage.fr'], sector: 'diy', source: 'French DIY chain (initial list)', verified: '2026-11-17' },
  { name: 'Fnac', aliases: ['fnac'], officialDomains: ['fnac.com'], sector: 'electronics', source: 'Large French electronics and culture retailer (initial list)', verified: '2026-11-17' },
  { name: 'Darty', aliases: ['darty'], officialDomains: ['darty.com', 'darty.fr'], sector: 'electronics', source: 'Large French electronics retailer (initial list)', verified: '2026-11-17' },
  { name: 'Decathlon', aliases: ['decathlon'], officialDomains: ['decathlon.fr', 'decathlon.com', 'decathlon.net', 'decathlon.eu'], sector: 'sport', source: 'Large French sports retailer (initial list)', verified: '2026-11-17' },
  { name: 'Boulanger', aliases: ['boulanger'], officialDomains: ['boulanger.com', 'boulanger.fr'], sector: 'electronics', source: 'Large French electronics retailer (initial list)', verified: '2026-11-17', commonWord: true },
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
  { name: 'Groupama', aliases: ['groupama'], officialDomains: ['groupama.fr', 'groupama.com', 'groupama.net', 'groupama.org', 'groupama.eu', 'groupama.info'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'MAIF', aliases: ['maif'], officialDomains: ['maif.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'Macif', aliases: ['macif'], officialDomains: ['macif.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'MAAF', aliases: ['maaf'], officialDomains: ['maaf.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'Matmut', aliases: ['matmut'], officialDomains: ['matmut.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },
  { name: 'GMF', aliases: ['gmf'], officialDomains: ['gmf.fr'], sector: 'insurance', source: 'Name borrowed by home-service scams (insurance)', verified: '2026-11-17' },

  // Delivery. "La Poste" is also part of the name of many hotels and
  // restaurants ("Hôtel de la Poste"): it is an exact alias. Colissimo is La
  // Poste's parcel service, on laposte.fr (colissimo.fr redirects there), so
  // it is an alias of La Poste rather than a brand of its own, whose real
  // pages would otherwise be flagged. "UPS" is an ordinary word, so it is commonWord and
  // only its full name counts for look-alike domains; "United Parcel Service"
  // is the multi-word form used there.
  { name: 'La Poste', aliases: ['la poste', 'laposte', 'colissimo'], exactAliases: ['la poste'], officialDomains: ['laposte.fr', 'colissimo.fr', 'laposte.com', 'laposte.net', 'colissimo.org'], sector: 'delivery', source: 'Frequently impersonated in parcel-delivery phishing (La Poste, Colissimo)', verified: '2026-11-17' },
  { name: 'Chronopost', aliases: ['chronopost'], officialDomains: ['chronopost.fr', 'chronopost.com'], sector: 'delivery', source: 'Frequently impersonated in parcel-delivery phishing', verified: '2026-11-17' },
  { name: 'Mondial Relay', aliases: ['mondial relay', 'mondialrelay'], officialDomains: ['mondialrelay.fr', 'mondialrelay.com', 'mondialrelay.net'], sector: 'delivery', source: 'Frequently impersonated in parcel-delivery phishing', verified: '2026-11-17' },
  { name: 'DHL', aliases: ['dhl', 'dhl express'], officialDomains: ['dhl.com', 'dhlexpress.fr'], sector: 'delivery', source: 'Frequently impersonated in parcel-delivery phishing', verified: '2026-11-17' },
  { name: 'UPS', aliases: ['ups', 'united parcel service'], officialDomains: ['ups.com'], sector: 'delivery', source: 'Frequently impersonated in parcel-delivery phishing', verified: '2026-11-17', commonWord: true },
  { name: 'FedEx', aliases: ['fedex', 'federal express'], officialDomains: ['fedex.com', 'fedex.fr', 'federalexpress.com'], sector: 'delivery', source: 'Frequently impersonated in parcel-delivery phishing', verified: '2026-11-17' },
  { name: 'Relais Colis', aliases: ['relais colis', 'relaiscolis'], officialDomains: ['relaiscolis.com'], sector: 'delivery', source: 'Frequently impersonated in parcel-delivery phishing', verified: '2026-11-17' },

  // Government. Names are the official service names; "Mon Compte Formation"
  // is used instead of the CPF acronym or "compte personnel de formation",
  // which training providers write on their own pages. "ANTS" is left out
  // as a single word: its full name is what the agency's pages use.
  // "Assurance maladie" is also a phrase in mutual insurers' names and titles.
  { name: 'Ameli (Assurance Maladie)', aliases: ['ameli', 'assurance maladie'], exactAliases: ['assurance maladie'], officialDomains: ['ameli.fr', 'assurance-maladie.fr'], sector: 'government', source: 'Government service often borrowed by health-insurance phishing', verified: '2026-11-17' },
  { name: 'impots.gouv (DGFiP)', aliases: ['impots.gouv', 'dgfip', 'direction generale des finances publiques'], officialDomains: ['impots.gouv.fr'], sector: 'government', source: 'Government service often borrowed by tax-refund phishing', verified: '2026-11-17' },
  { name: 'ANTS', aliases: ['agence nationale des titres securises'], officialDomains: ['ants.gouv.fr'], sector: 'government', source: 'Government service often borrowed by phishing about vehicle documents and fines', verified: '2026-11-17' },
  { name: 'CAF', aliases: ['caf', 'caisse d allocations familiales'], officialDomains: ['caf.fr'], sector: 'government', source: 'Government service often borrowed by benefit-payment phishing', verified: '2026-11-17' },
  { name: "Crit'Air", aliases: ['crit air', 'critair', 'certificat qualite de l air'], officialDomains: ['certificat-air.gouv.fr'], sector: 'government', source: 'Government certificate often sold on look-alike paid sites', verified: '2026-11-17' },
  { name: 'Mon Compte Formation', aliases: ['mon compte formation', 'moncompteformation'], officialDomains: ['moncompteformation.gouv.fr'], sector: 'government', source: 'Government service often borrowed by training-fund (CPF) scam sites', verified: '2026-11-17' },
  { name: 'Service-Public.fr', aliases: ['service-public.fr'], officialDomains: ['service-public.fr', 'service-public.gouv.fr'], sector: 'government', source: 'Government service often borrowed by phishing about administrative procedures', verified: '2026-11-17' },
];
