// Shared by the popup and settings pages, which import t() from here. Static
// text is marked up with data-i18n* attributes holding a _locales key; the
// English text left in the HTML only shows if a key is missing. The top-level
// await means importing pages run once the chosen language is loaded and the
// page is translated.
import './browser.js';
import { t, uiLanguage, i18nReady } from '../core/i18n.js';

export { t, uiLanguage };

await i18nReady;

function translateIfAvailable(key) {
  const message = t(key);
  return message === key ? null : message;
}

document.documentElement.lang = uiLanguage();
for (const el of document.querySelectorAll('[data-i18n]')) {
  const message = translateIfAvailable(el.dataset.i18n);
  if (message !== null) el.textContent = message;
}
for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
  const message = translateIfAvailable(el.dataset.i18nPlaceholder);
  if (message !== null) el.placeholder = message;
}
for (const el of document.querySelectorAll('[data-i18n-aria-label]')) {
  const message = translateIfAvailable(el.dataset.i18nAriaLabel);
  if (message !== null) el.setAttribute('aria-label', message);
}
const titleKey = document.documentElement.dataset.i18nTitle;
if (titleKey) {
  const message = translateIfAvailable(titleKey);
  if (message !== null) document.title = message;
}
