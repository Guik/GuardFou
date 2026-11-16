// GuardFou installed temporarily in Firefox through WebDriver BiDi. BiDi
// can't open moz-extension:// pages, so this only checks what a page shows:
// the fake shop gets the red banner without a click, which needs the
// content script, the background scoring and the translations to work.
// Uses FIREFOX_PATH, or Firefox's default macOS location.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { startShopServer, REPO, waitFor } from './fixture.js';

let server, browser;

before(async () => {
  server = await startShopServer();
  browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: process.env.FIREFOX_PATH || '/Applications/Firefox.app/Contents/MacOS/firefox',
    headless: true,
  });
  await browser.installExtension(REPO);
});

after(async () => {
  await browser?.close();
  await server?.close();
});

test('a fake shop gets the red banner on load', async () => {
  const shop = await browser.newPage();
  await shop.goto(server.url);
  assert.ok(await waitFor(() => shop.evaluate(() => Boolean(document.getElementById('guardfou-banner-host')))));
});
