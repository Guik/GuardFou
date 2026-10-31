import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWatchedRegistrar } from '../src/core/registrar.js';

const WATCHED = ['realtime register'];

test('matches regardless of punctuation/suffix/case', () => {
  assert.equal(isWatchedRegistrar('Realtime Register B.V.', WATCHED), true);
  assert.equal(isWatchedRegistrar('REALTIME REGISTER B.V.', WATCHED), true);
});

test('does not match an unrelated registrar', () => {
  assert.equal(isWatchedRegistrar('OVH SAS', WATCHED), false);
});

test('handles null/empty registrar name', () => {
  assert.equal(isWatchedRegistrar(null, WATCHED), false);
  assert.equal(isWatchedRegistrar('', WATCHED), false);
});
