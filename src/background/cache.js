const PREFIX = 'fakeshield:cache:';

/**
 * @param {string} key
 * @param {number} ttlMs
 * @returns {Promise<any>} undefined when missing or expired
 */
export async function getCached(key, ttlMs) {
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
  await browser.storage.local.set({ [PREFIX + key]: { value, timestamp: Date.now() } });
}
