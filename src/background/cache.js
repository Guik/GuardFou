export const CACHE_PREFIX = 'fakeshield:cache:';
const PREFIX = CACHE_PREFIX;

/** @returns {Promise<boolean>} */
export async function isCacheDisabled() {
  const { cacheDisabled = false } = await browser.storage.local.get('cacheDisabled');
  return cacheDisabled;
}

/**
 * @param {string} key
 * @param {number} ttlMs
 * @returns {Promise<any>} undefined when missing, expired, or caching is disabled
 */
export async function getCached(key, ttlMs) {
  if (await isCacheDisabled()) return undefined;
  const storageKey = PREFIX + key;
  const stored = await browser.storage.local.get(storageKey);
  const entry = stored[storageKey];
  if (!entry || Date.now() - entry.timestamp > ttlMs) return undefined;
  return entry.value;
}

/**
 * @param {string} key
 * @param {any} value
 */
export async function setCached(key, value) {
  if (await isCacheDisabled()) return;
  await browser.storage.local.set({ [PREFIX + key]: { value, timestamp: Date.now() } });
}

/** Clears all cached RDAP/DNSSEC/legal-page lookups. @returns {Promise<number>} entries removed */
export async function clearCache() {
  const all = await browser.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter((key) => key.startsWith(PREFIX));
  await browser.storage.local.remove(cacheKeys);
  return cacheKeys.length;
}
