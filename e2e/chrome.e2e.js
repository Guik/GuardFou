// GuardFou loaded unpacked in Chromium: the page is checked without a
// click, then the badge, the banner, the popup (in both languages) and the
// identity card are read back. Needs Playwright's Chromium:
// `npx playwright-core install chromium` (CHROMIUM_PATH overrides it).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startShopServer, REPO, waitFor } from './fixture.js';

let server, context, extensionId;

before(async () => {
  server = await startShopServer();
  context = await chromium.launchPersistentContext('', {
    // The full Chromium build, not the headless shell, which can't load extensions.
    channel: 'chromium',
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [`--disable-extensions-except=${REPO}`, `--load-extension=${REPO}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
});

after(async () => {
  await context?.close();
  await server?.close();
});

async function extensionPage(path) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${path}`);
  return page;
}

test('a fake shop is checked on load and flagged red, with badge and banner', async () => {
  const shop = await context.newPage();
  await shop.goto(server.url);
  const settings = await extensionPage('src/options/options.html');
  const tabId = await settings.evaluate(async (url) => (await chrome.tabs.query({ url }))[0].id, server.url);

  const verdict = await waitFor(() => settings.evaluate((id) => chrome.runtime.sendMessage({ type: 'GET_VERDICT', tabId: id }), tabId));
  assert.equal(verdict.band, 'red');
  assert.deepEqual(verdict.reasons.map((r) => r.id).sort(), ['brand-domain-mismatch', 'insecure-http', 'ip-hostname']);
  assert.equal(await settings.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId), String(verdict.score));
  await waitFor(() => shop.evaluate(() => Boolean(document.getElementById('guardfou-banner-host'))));

  const card = await settings.evaluate((id) => chrome.runtime.sendMessage({ type: 'GET_IDENTITY_CARD', tabId: id }), tabId);
  assert.ok(card && !card.needsReload, 'identity card');

  // The popup reads the active tab: open it in the background, shop in front.
  const popup = await context.newPage();
  await shop.bringToFront();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await waitFor(() => popup.locator('#score-number').textContent());
  assert.equal(await popup.locator('#score-number').textContent(), String(verdict.score));
  assert.equal(await popup.locator('#reasons li').count(), 3);
  // An IP address has no domain or company to look up: the summary points to the identity card.
  assert.equal(await popup.locator('#summary li').count(), 1);

  await settings.evaluate(() => chrome.storage.sync.set({ language: 'fr' }));
  await popup.reload();
  await waitFor(async () => (await popup.locator('#band-label').textContent()) === 'Risque élevé');
  await settings.evaluate(() => chrome.storage.sync.remove('language'));
});

test('the settings page follows the chosen language', async () => {
  const settings = await extensionPage('src/options/options.html');
  assert.equal(await settings.locator('h2').first().textContent(), 'Page access');
  await settings.selectOption('#language-select', 'fr');
  await waitFor(async () => (await settings.locator('h2').first().textContent()) === 'Accès aux pages');
  await settings.evaluate(() => chrome.storage.sync.remove('language'));
});
