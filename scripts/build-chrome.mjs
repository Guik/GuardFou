// Builds web-ext-artifacts/chrome-guardfou-<version>.zip for the Chrome Web
// Store: the same files as the Firefox build (web-ext build, so the same
// ignoreFiles), with manifest.json at the root of the zip and the keys only
// Firefox reads removed — browser_specific_settings, and background.scripts
// (Chrome uses background.service_worker). Needs the zip and unzip commands.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const { version } = JSON.parse(readFileSync('manifest.json', 'utf8'));
const output = resolve('web-ext-artifacts', `chrome-guardfou-${version}.zip`);
const stage = mkdtempSync(join(tmpdir(), 'guardfou-chrome-'));

try {
  execFileSync('npx', ['--no-install', 'web-ext', 'build', '--artifacts-dir', stage, '--filename', 'firefox.zip'], { stdio: 'inherit' });
  const files = join(stage, 'files');
  execFileSync('unzip', ['-q', join(stage, 'firefox.zip'), '-d', files]);

  const manifestPath = join(files, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  delete manifest.browser_specific_settings;
  delete manifest.background.scripts;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  mkdirSync(resolve('web-ext-artifacts'), { recursive: true });
  rmSync(output, { force: true });
  execFileSync('zip', ['-q', '-r', '-X', output, '.'], { cwd: files });
  console.log(`Chrome Web Store package: ${output}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
