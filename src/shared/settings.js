import './browser.js';

// Preferences use storage.sync. Lookup results and cache metadata deliberately
// stay in storage.local.
export const SYNC_SETTING_KEYS = [
  'language',
  'allowlist',
  'checkAgeOnEverySite',
  'ignorePrivateIpWarnings',
  'dropshippingAlert',
  'cacheDisabled',
];

let migrationPromise;
let retryMigrationAfter = 0;

/** Move existing preferences from local storage once, without replacing any
 * value already synced from another browser. */
export async function ensureSettingsSynced() {
  if (Date.now() < retryMigrationAfter) return;
  if (!migrationPromise) {
    migrationPromise = migrateSettings().then((complete) => {
      if (!complete) {
        retryMigrationAfter = Date.now() + 60_000;
        migrationPromise = null;
      }
    });
  }
  return migrationPromise;
}

// storage.sync goes through the browser's sync service and can be slow or
// never answer (Firefox Sync mid-sync, sync disabled). Every page that reads
// a setting waits on it, so a hung read would freeze the popup and every
// analysis: past this delay, sync counts as unavailable and the local copy
// is used, like when sync is turned off.
const SYNC_TIMEOUT_MS = 3000;
// After a timeout, sync isn't waited on again for a while: settings are read
// on every cache access, and paying the timeout each time adds up to tens
// of seconds per analysis.
const SYNC_RETRY_AFTER_MS = 5 * 60 * 1000;
let syncUnavailableUntil = 0;

function syncArea() {
  return Date.now() < syncUnavailableUntil ? null : browser.storage?.sync;
}

function markSyncUnavailable(error) {
  if (error?.message === 'storage timeout') syncUnavailableUntil = Date.now() + SYNC_RETRY_AFTER_MS;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('storage timeout')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function read(area, keys) {
  try {
    return { values: await withTimeout(area.get(keys), SYNC_TIMEOUT_MS), available: true };
  } catch (error) {
    if (area === browser.storage?.sync) markSyncUnavailable(error);
    return { values: {}, available: false };
  }
}

async function migrateSettings() {
  const [syncResult, localResult] = await Promise.all([
    read(syncArea(), SYNC_SETTING_KEYS),
    read(browser.storage?.local, SYNC_SETTING_KEYS),
  ]);
  if (!syncResult.available || !localResult.available) return false;

  const synced = syncResult.values;
  const local = localResult.values;
  const missing = {};
  for (const key of SYNC_SETTING_KEYS) {
    if (synced[key] === undefined && local[key] !== undefined) missing[key] = local[key];
  }
  if (Object.keys(missing).length > 0) {
    try {
      await withTimeout(browser.storage.sync.set(missing), SYNC_TIMEOUT_MS);
    } catch (error) {
      markSyncUnavailable(error);
      // Keep the old local copy. getSettings() will continue to use it until
      // sync storage is available and the migration can be retried.
      return false;
    }
  }

  const oldLocalKeys = SYNC_SETTING_KEYS.filter((key) => local[key] !== undefined);
  if (oldLocalKeys.length > 0) {
    try {
      await browser.storage.local.remove(oldLocalKeys);
    } catch {
      // Synced values take precedence if legacy local copies cannot be removed.
    }
  }
  return true;
}

export async function getSettings(keys) {
  await ensureSettingsSynced();
  const [syncResult, localResult] = await Promise.all([
    read(syncArea(), keys),
    read(browser.storage?.local, keys),
  ]);
  return { ...localResult.values, ...syncResult.values };
}

export async function setSettings(values) {
  await ensureSettingsSynced();
  try {
    const sync = syncArea();
    if (!sync) throw new Error('sync unavailable');
    await withTimeout(sync.set(values), SYNC_TIMEOUT_MS);
    await browser.storage.local.remove(Object.keys(values));
  } catch (error) {
    markSyncUnavailable(error);
    // Preserve the preference locally if sync is unavailable or over quota.
    await browser.storage.local.set(values);
    migrationPromise = null;
    retryMigrationAfter = Date.now() + 60_000;
  }
}

export async function removeSettings(keys) {
  await ensureSettingsSynced();
  const sync = syncArea();
  if (sync) await withTimeout(sync.remove(keys), SYNC_TIMEOUT_MS).catch(markSyncUnavailable);
  await browser.storage.local.remove(keys);
}
