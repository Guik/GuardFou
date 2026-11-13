// Shared by the popup and settings pages, which import t() from here. Static
// text is marked up with data-i18n* attributes holding a _locales key; the
// English text left in the HTML only shows if a key is missing. The top-level
// await means importing pages run once the chosen language is loaded and the
// page is translated.
import './browser.js';
import { t, uiLanguage, i18nReady } from '../core/i18n.js';

export { t, uiLanguage };

await i18nReady;

document.documentElement.lang = uiLanguage();
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
for (const el of document.querySelectorAll('[data-i18n-aria-label]')) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
const titleKey = document.documentElement.dataset.i18nTitle;
if (titleKey) document.title = t(titleKey);
