/**
 * Known French retail brands and their official domains, used to catch sites
 * that present themselves as a brand without being one of its real domains
 * (e.g. "chaussonconstruction.com" claiming to be "Chausson").
 * Extend this list from the options page.
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
];
