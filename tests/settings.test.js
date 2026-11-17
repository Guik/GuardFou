import { test } from 'node:test';
import assert from 'node:assert/strict';

function memoryArea(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      if (keys === null) return { ...data };
      return Object.fromEntries([keys].flat().filter((k) => k in data).map((k) => [k, data[k]]));
    },
    async set(items) { Object.assign(data, items); },
    async remove(keys) { for (const k of [keys].flat()) delete data[k]; },
  };
}

// A sync storage that never answers, as Firefox Sync can when it is stuck.
const hungArea = { get: () => new Promise(() => {}), set: () => new Promise(() => {}), remove: () => new Promise(() => {}) };

test('a sync storage that never answers falls back to the local copy instead of hanging', async () => {
  const local = memoryArea({ language: 'fr' });
  globalThis.browser = { storage: { sync: hungArea, local } };
  // A fresh module instance, so no migration state is shared with other tests.
  const { getSettings, setSettings } = await import(`../src/shared/settings.js?hung=${Date.now()}`);

  const started = Date.now();
  assert.deepEqual(await getSettings('language'), { language: 'fr' });
  assert.ok(Date.now() - started < 8000, 'answers within the timeouts');

  // Once sync has timed out, it isn't waited on again: the next reads are immediate.
  const again = Date.now();
  assert.deepEqual(await getSettings('language'), { language: 'fr' });
  assert.ok(Date.now() - again < 500, 'no second timeout');

  await setSettings({ checkAgeOnEverySite: true });
  assert.equal(local.data.checkAgeOnEverySite, true, 'kept locally when sync does not answer');
});

test('settings move from local to sync storage without overwriting a synced value', async () => {
  const local = memoryArea({ language: 'fr', cacheDisabled: true });
  const sync = memoryArea({ language: 'en' });
  globalThis.browser = { storage: { sync, local } };
  const { getSettings } = await import(`../src/shared/settings.js?migrate=${Date.now()}`);

  assert.deepEqual(await getSettings(['language', 'cacheDisabled']), { language: 'en', cacheDisabled: true });
  assert.deepEqual(sync.data, { language: 'en', cacheDisabled: true });
  assert.deepEqual(local.data, {});
});
