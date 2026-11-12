import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_PREFIX, CACHE_TTL_MS, getCached, setCached, pruneExpiredCache } from '../src/background/cache.js';

const DAY_MS = 24 * 60 * 60 * 1000;
let stored;

beforeEach(() => {
  stored = {};
  globalThis.browser = {
    storage: {
      local: {
        async get(keys) {
          if (keys === null) return { ...stored };
          return Object.fromEntries([keys].flat().filter((k) => k in stored).map((k) => [k, stored[k]]));
        },
        async set(items) { Object.assign(stored, items); },
        async remove(keys) { for (const k of [keys].flat()) delete stored[k]; },
      },
    },
  };
});

test('setCached/getCached round-trip, and expired entries read as missing', async () => {
  await setCached('rdap:example.fr', { ageDays: 10 });
  assert.deepEqual(await getCached('rdap:example.fr', CACHE_TTL_MS), { ageDays: 10 });
  stored[`${CACHE_PREFIX}rdap:example.fr`].timestamp -= CACHE_TTL_MS + 1;
  assert.equal(await getCached('rdap:example.fr', CACHE_TTL_MS), undefined);
});

test('pruneExpiredCache deletes only expired cache entries', async () => {
  const now = Date.now();
  stored[`${CACHE_PREFIX}fresh`] = { value: 1, timestamp: now - DAY_MS };
  stored[`${CACHE_PREFIX}old`] = { value: 2, timestamp: now - CACHE_TTL_MS - DAY_MS };
  stored[`${CACHE_PREFIX}malformed`] = { value: 3 };
  stored.allowlist = ['example.fr']; // a setting, not a cache entry
  assert.equal(await pruneExpiredCache(now), 2);
  assert.deepEqual(Object.keys(stored).sort(), [`${CACHE_PREFIX}fresh`, 'allowlist', 'cacheLastPrunedAt'].sort());
});

test('pruneExpiredCache runs at most once a day', async () => {
  const now = Date.now();
  await pruneExpiredCache(now);
  stored[`${CACHE_PREFIX}old`] = { value: 2, timestamp: 0 };
  assert.equal(await pruneExpiredCache(now + DAY_MS / 2), 0);
  assert.ok(`${CACHE_PREFIX}old` in stored);
  assert.equal(await pruneExpiredCache(now + DAY_MS + 1), 1);
});
