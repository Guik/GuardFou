import { t } from '../shared/i18n.js';
import { getSettings, setSettings, removeSettings } from '../shared/settings.js';
import { LANGUAGE_KEY, LANGUAGES } from '../core/i18n.js';
import { clearCache, isCacheDisabled } from '../background/cache.js';

async function refreshPermissionStatus() {
  const hasAccess = await browser.permissions.contains({ origins: ['<all_urls>'] });
  document.getElementById('permission-status').textContent = t(hasAccess ? 'optionsAccessGranted' : 'optionsAccessMissing');
  document.getElementById('permission-dot').className = `status-dot ${hasAccess ? 'ok' : 'missing'}`;
  document.getElementById('activate-btn').hidden = hasAccess;
}

document.getElementById('activate-btn').addEventListener('click', async () => {
  const granted = await browser.permissions.request({ origins: ['<all_urls>'] });
  if (granted) refreshPermissionStatus();
});

async function refreshAllowlist() {
  const { allowlist = [] } = await getSettings('allowlist');
  const ul = document.getElementById('allowlist');
  ul.innerHTML = '';
  for (const domain of allowlist) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = domain;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = t('optionsRemove');
    removeBtn.addEventListener('click', async () => {
      const next = allowlist.filter((d) => d !== domain);
      await setSettings({ allowlist: next });
      refreshAllowlist();
    });
    li.append(span, removeBtn);
    ul.appendChild(li);
  }
}

document.getElementById('add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('add-input');
  const domain = input.value.trim().toLowerCase();
  if (!domain) return;
  const { allowlist = [] } = await getSettings('allowlist');
  if (!allowlist.includes(domain)) {
    allowlist.push(domain);
    await setSettings({ allowlist });
  }
  input.value = '';
  refreshAllowlist();
});


document.getElementById('clear-cache-btn').addEventListener('click', async () => {
  const removed = await clearCache();
  document.getElementById('clear-cache-status').textContent = t('optionsCacheCleared', removed);
});

const disableCacheCheckbox = document.getElementById('disable-cache-checkbox');
disableCacheCheckbox.addEventListener('change', async () => {
  await setSettings({ cacheDisabled: disableCacheCheckbox.checked });
});

const checkAgeEverywhereCheckbox = document.getElementById('check-age-everywhere-checkbox');
checkAgeEverywhereCheckbox.addEventListener('change', async () => {
  await setSettings({ checkAgeOnEverySite: checkAgeEverywhereCheckbox.checked });
});

async function refreshCheckAgeToggle() {
  const { checkAgeOnEverySite = false } = await getSettings('checkAgeOnEverySite');
  checkAgeEverywhereCheckbox.checked = checkAgeOnEverySite;
}

const ignorePrivateIpWarningsCheckbox = document.getElementById('ignore-private-ip-warnings-checkbox');
ignorePrivateIpWarningsCheckbox.addEventListener('change', async () => {
  await setSettings({ ignorePrivateIpWarnings: ignorePrivateIpWarningsCheckbox.checked });
});

async function refreshPrivateIpWarningsToggle() {
  const { ignorePrivateIpWarnings = false } = await getSettings('ignorePrivateIpWarnings');
  ignorePrivateIpWarningsCheckbox.checked = ignorePrivateIpWarnings;
}

const languageSelect = document.getElementById('language-select');
languageSelect.addEventListener('change', async () => {
  if (languageSelect.value) await setSettings({ [LANGUAGE_KEY]: languageSelect.value });
  else await removeSettings(LANGUAGE_KEY);
  window.location.reload();
});

async function refreshLanguage() {
  const { [LANGUAGE_KEY]: language } = await getSettings(LANGUAGE_KEY);
  languageSelect.value = LANGUAGES.includes(language) ? language : '';
}

async function refreshCacheToggle() {
  disableCacheCheckbox.checked = await isCacheDisabled();
}

refreshPermissionStatus();
refreshAllowlist();
refreshCheckAgeToggle();
refreshPrivateIpWarningsToggle();
refreshLanguage();
refreshCacheToggle();
