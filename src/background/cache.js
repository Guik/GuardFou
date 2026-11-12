export const CACHE_PREFIX = 'guardfou:cache:';
const PREFIX = CACHE_PREFIX;

/** How long every lookup (RDAP, DNSSEC, legal pages, company registry) stays cached. */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

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

/**
 * Deletes cache entries older than CACHE_TTL_MS. Reads already ignore
 * expired entries, but without this they'd stay in storage forever — one
 * per site ever visited. Runs at most once a day; meant to be called each
 * time the background script starts.
 * @param {number} [now]
 * @returns {Promise<number>} entries removed
 */
export async function pruneExpiredCache(now = Date.now()) {
  const { cacheLastPrunedAt = 0 } = await browser.storage.local.get('cacheLastPrunedAt');
  if (now - cacheLastPrunedAt < PRUNE_INTERVAL_MS) return 0;
  const all = await browser.storage.local.get(null);
  const isExpired = (entry) => !(typeof entry?.timestamp === 'number' && now - entry.timestamp <= CACHE_TTL_MS);
  const expiredKeys = Object.keys(all).filter((key) => key.startsWith(PREFIX) && isExpired(all[key]));
  await browser.storage.local.remove(expiredKeys);
  await browser.storage.local.set({ cacheLastPrunedAt: now });
  return expiredKeys.length;
}

/** Clears all cached RDAP/DNSSEC/legal-page lookups. @returns {Promise<number>} entries removed */
export async function clearCache() {
  const all = await browser.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter((key) => key.startsWith(PREFIX));
  await browser.storage.local.remove(cacheKeys);
  return cacheKeys.length;
}
