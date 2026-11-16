import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releaseNotesFor } from '../scripts/release-notes.mjs';

const CHANGELOG = `# Changelog

## 1.2.0

### English

- New thing.

### Français

- Nouveauté.

## 1.1.0

### English

- Older.
`;

test('releaseNotesFor returns each language of the requested version only', () => {
  assert.deepEqual(releaseNotesFor(CHANGELOG, '1.2.0'), { 'en-US': '- New thing.', fr: '- Nouveauté.' });
  assert.deepEqual(releaseNotesFor(CHANGELOG, '1.1.0'), { 'en-US': '- Older.' });
  assert.equal(releaseNotesFor(CHANGELOG, '1.0.0'), null);
});

// Fails as soon as manifest.json's version is bumped without notes, on the
// push that bumps it, rather than later on the tag.
test('CHANGELOG.md has English and French notes for the manifest version', () => {
  const { version } = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const notes = releaseNotesFor(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), version);
  assert.ok(notes?.['en-US'], `no English notes for ${version}`);
  assert.ok(notes?.fr, `no French notes for ${version}`);
});
