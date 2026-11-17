/**
 * Known French brands and their official domains, used to catch sites that
 * present themselves as a brand without being one of its real domains
 * (e.g. "chaussonconstruction.com" claiming to be "Chausson"). Retailers,
 * plus the windshield, energy and insurance names that scam sites for home
 * services borrow. List every domain a brand really uses, group sites
 * included, or its own sites get flagged.
 */
export const BRANDS_FR = [
  { name: 'Chausson Matériaux', aliases: ['chausson materiaux', 'chausson'], officialDomains: ['chausson.fr'] },
  { name: 'Leroy Merlin', aliases: ['leroy merlin', 'leroymerlin'], officialDomains: ['leroymerlin.fr'] },
  { name: 'Castorama', aliases: ['castorama'], officialDomains: ['castorama.fr'] },
  { name: 'Brico Dépôt', aliases: ['brico depot', 'bricodepot'], officialDomains: ['bricodepot.fr'] },
  { name: 'Point.P', aliases: ['point p', 'pointp'], officialDomains: ['pointp.fr'] },
  { name: 'Gedimat', aliases: ['gedimat'], officialDomains: ['gedimat.fr'] },
  { name: 'Weldom', aliases: ['weldom'], officialDomains: ['weldom.fr'] },
  { name: 'Mr Bricolage', aliases: ['mr bricolage', 'mr. bricolage'], officialDomains: ['mr-bricolage.fr'] },
  { name: 'Fnac', aliases: ['fnac'], officialDomains: ['fnac.com'] },
  { name: 'Darty', aliases: ['darty'], officialDomains: ['darty.com'] },
  { name: 'Decathlon', aliases: ['decathlon'], officialDomains: ['decathlon.fr'] },
  { name: 'Boulanger', aliases: ['boulanger'], officialDomains: ['boulanger.com'] },
  { name: 'Cdiscount', aliases: ['cdiscount'], officialDomains: ['cdiscount.com'] },
  { name: 'Manomano', aliases: ['manomano'], officialDomains: ['manomano.fr'] },

  // Windshield repair
  { name: 'Carglass', aliases: ['carglass'], officialDomains: ['carglass.fr'] },
  { name: 'France Pare-Brise', aliases: ['france pare brise', 'franceparebrise'], officialDomains: ['franceparebrise.fr'] },
  { name: 'Mondial Pare-Brise', aliases: ['mondial pare brise', 'mondialparebrise'], officialDomains: ['mondialparebrise.fr'] },

  // Energy
  { name: 'EDF', aliases: ['edf'], officialDomains: ['edf.fr', 'edf.com', 'edfenr.com', 'edf-solutions-solaires.com'] },
  { name: 'Engie', aliases: ['engie'], officialDomains: ['engie.fr', 'engie.com'] },
  { name: 'TotalEnergies', aliases: ['totalenergies', 'total energies'], officialDomains: ['totalenergies.fr', 'totalenergies.com'] },

  // Insurance
  { name: 'AXA', aliases: ['axa'], officialDomains: ['axa.fr', 'axa.com'] },
  { name: 'Allianz', aliases: ['allianz'], officialDomains: ['allianz.fr', 'allianz.com', 'allianzdirect.fr', 'allianzdirect.de', 'allianzdirect.nl', 'allianzdirect.es', 'allianzdirect.it'] },
  { name: 'Groupama', aliases: ['groupama'], officialDomains: ['groupama.fr', 'groupama.com'] },
  { name: 'MAIF', aliases: ['maif'], officialDomains: ['maif.fr'] },
  { name: 'Macif', aliases: ['macif'], officialDomains: ['macif.fr'] },
  { name: 'MAAF', aliases: ['maaf'], officialDomains: ['maaf.fr'] },
  { name: 'Matmut', aliases: ['matmut'], officialDomains: ['matmut.fr'] },
  { name: 'GMF', aliases: ['gmf'], officialDomains: ['gmf.fr'] },
];
