// Data for the dropshipping clues in core/dropshipping.js. Dropshipping is
// not a scam: the shop resells products a supplier ships straight to the
// buyer, usually from Asia. These clues only feed the optional dropshipping
// alert, never the risk score.

/**
 * Registered-office addresses rented to many dropshipping shops at once,
 * typically a company secretary's address in Hong Kong. Add one only after
 * seeing it on several unrelated shops, with where it was seen in `source`.
 */
export const VIRTUAL_OFFICE_ADDRESSES = [
  {
    name: 'Beverley Commercial Centre, Kowloon',
    pattern: /beverley\s+commercial\s+cent(?:re|er)|87\s*[-–]\s*105\s+chatham\s+road/i,
    source: 'Legal notice of mario-boutique.fr, and widely reused by Shopify dropshipping shops (2026-11-22)',
  },
];

/**
 * Places in a seller's address that put it in Hong Kong or mainland China,
 * where most dropshipping suppliers and many shop owners are. Cities rather
 * than just "Chine": "fabriqué en Chine" on a product page says nothing
 * about the seller. Matched as whole words, case and accents ignored.
 */
export const ASIAN_SELLER_PLACES = [
  'Hong Kong', 'Kowloon', 'Tsim Sha Tsui', 'Wan Chai', 'Sheung Wan', 'Mong Kok',
  'Shenzhen', 'Guangzhou', 'Guangdong', 'Dongguan', 'Foshan', 'Yiwu', 'Hangzhou',
  'Zhejiang', 'Ningbo', 'Fujian', 'Xiamen', 'Shanghai', 'Beijing', 'Jiangsu',
  "People's Republic of China", 'République populaire de Chine',
];
