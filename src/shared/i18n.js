// Classic script shared by the popup and settings pages (loaded before their
// own script). Static text is marked up with data-i18n* attributes holding a
// _locales key; the English text left in the HTML only shows if a key is
// missing.
function t(key, ...substitutions) {
  return browser.i18n.getMessage(key, substitutions.map(String)) || key;
}

(function localizePage() {
  document.documentElement.lang = browser.i18n.getUILanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of document.querySelectorAll('[data-i18n-aria-label]')) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  const titleKey = document.documentElement.dataset.i18nTitle;
  if (titleKey) document.title = t(titleKey);
})();
