// Reads the CHANGELOG.md section for manifest.json's version and writes:
//   --amo <file>     amo-metadata.json with version.release_notes added,
//                    for `web-ext sign --amo-metadata`
//   --github <file>  both languages as Markdown, for the GitHub Release
// Fails when the version has no section or no English part, so a release
// can't go out without notes. Run from the repository root.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LANGUAGES = { English: 'en-US', Français: 'fr' };

/**
 * @param {string} changelog contents of CHANGELOG.md
 * @param {string} version e.g. "0.1.2"
 * @returns {Record<string, string> | null} AMO locale → notes, or null when the version has no section
 */
export function releaseNotesFor(changelog, version) {
  const sections = changelog.split(/^## /m).slice(1);
  const section = sections.find((s) => s.split('\n', 1)[0].trim() === version);
  if (!section) return null;
  const notes = {};
  for (const part of section.split(/^### /m).slice(1)) {
    const [heading, ...body] = part.split('\n');
    const locale = LANGUAGES[heading.trim()];
    const text = body.join('\n').trim();
    if (locale && text) notes[locale] = text;
  }
  return notes;
}

function main(args) {
  const option = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? null : args[i + 1];
  };
  const { version } = JSON.parse(readFileSync('manifest.json', 'utf8'));
  const notes = releaseNotesFor(readFileSync('CHANGELOG.md', 'utf8'), version);
  if (!notes?.['en-US']) {
    console.error(`CHANGELOG.md has no "## ${version}" section with an English part.`);
    process.exit(1);
  }

  const write = (file, contents) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
    console.log(`Release notes for ${version}: ${file}`);
  };
  const amoFile = option('--amo');
  if (amoFile) {
    const metadata = JSON.parse(readFileSync('amo-metadata.json', 'utf8'));
    metadata.version = { ...metadata.version, release_notes: notes };
    write(amoFile, `${JSON.stringify(metadata, null, 2)}\n`);
  }
  const githubFile = option('--github');
  if (githubFile) {
    const names = Object.fromEntries(Object.entries(LANGUAGES).map(([name, locale]) => [locale, name]));
    write(githubFile, Object.entries(notes).map(([locale, text]) => `### ${names[locale]}\n\n${text}`).join('\n\n') + '\n');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
