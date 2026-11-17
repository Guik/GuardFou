import './browser.js';

// Preferences use storage.sync. Lookup results and cache metadata deliberately
// stay in storage.local.
export const SYNC_SETTING_KEYS = [
  'language',
  'allowlist',
  'checkAgeOnEverySite',
  'ignorePrivateIpWarnings',
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

async function read(area, keys) {
  try {
    return { values: await area.get(keys), available: true };
  } catch {
    return { values: {}, available: false };
  }
}

async function migrateSettings() {
  const [syncResult, localResult] = await Promise.all([
    read(browser.storage?.sync, SYNC_SETTING_KEYS),
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
      await browser.storage.sync.set(missing);
    } catch {
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
    read(browser.storage?.sync, keys),
    read(browser.storage?.local, keys),
  ]);
  return { ...localResult.values, ...syncResult.values };
}

export async function setSettings(values) {
  await ensureSettingsSynced();
  try {
    await browser.storage.sync.set(values);
    await browser.storage.local.remove(Object.keys(values));
  } catch {
    // Preserve the preference locally if sync is unavailable or over quota.
    await browser.storage.local.set(values);
    migrationPromise = null;
    retryMigrationAfter = Date.now() + 60_000;
  }
}

export async function removeSettings(keys) {
  await ensureSettingsSynced();
  await browser.storage.sync.remove(keys);
  await browser.storage.local.remove(keys);
}
