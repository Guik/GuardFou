import { WATCHED_REGISTRARS } from '../data/watched-registrars.js';
import { clearCache } from '../background/cache.js';

async function refreshPermissionStatus() {
  const hasAccess = await browser.permissions.contains({ origins: ['<all_urls>'] });
  document.getElementById('permission-status').textContent = hasAccess
    ? 'Accès accordé.'
    : 'Accès non accordé : FakeShield ne peut analyser aucune page.';
  document.getElementById('permission-dot').className = `status-dot ${hasAccess ? 'ok' : 'missing'}`;
  document.getElementById('activate-btn').hidden = hasAccess;
}

async function refreshAllowlist() {
  const { allowlist = [] } = await browser.storage.local.get('allowlist');
  const ul = document.getElementById('allowlist');
  ul.innerHTML = '';
  for (const domain of allowlist) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = domain;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Retirer';
    removeBtn.addEventListener('click', async () => {
      const next = allowlist.filter((d) => d !== domain);
      await browser.storage.local.set({ allowlist: next });
      refreshAllowlist();
    });
    li.append(span, removeBtn);
    ul.appendChild(li);
  }
}

document.getElementById('activate-btn').addEventListener('click', async () => {
  const granted = await browser.permissions.request({ origins: ['<all_urls>'] });
  if (granted) refreshPermissionStatus();
});

document.getElementById('add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('add-input');
  const domain = input.value.trim().toLowerCase();
  if (!domain) return;
  const { allowlist = [] } = await browser.storage.local.get('allowlist');
  if (!allowlist.includes(domain)) {
    allowlist.push(domain);
    await browser.storage.local.set({ allowlist });
  }
  input.value = '';
  refreshAllowlist();
});

async function refreshRegistrarList() {
  const { customWatchedRegistrars = [] } = await browser.storage.local.get('customWatchedRegistrars');
  const ul = document.getElementById('registrar-list');
  ul.innerHTML = '';
  for (const name of customWatchedRegistrars) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = name;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Retirer';
    removeBtn.addEventListener('click', async () => {
      const next = customWatchedRegistrars.filter((r) => r !== name);
      await browser.storage.local.set({ customWatchedRegistrars: next });
      refreshRegistrarList();
    });
    li.append(span, removeBtn);
    ul.appendChild(li);
  }
}

document.getElementById('add-registrar-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('add-registrar-input');
  const name = input.value.trim().toLowerCase();
  if (!name) return;
  const { customWatchedRegistrars = [] } = await browser.storage.local.get('customWatchedRegistrars');
  if (!customWatchedRegistrars.includes(name)) {
    customWatchedRegistrars.push(name);
    await browser.storage.local.set({ customWatchedRegistrars });
  }
  input.value = '';
  refreshRegistrarList();
});

document.getElementById('builtin-registrars').textContent = WATCHED_REGISTRARS.join(', ');

document.getElementById('clear-cache-btn').addEventListener('click', async () => {
  const removed = await clearCache();
  document.getElementById('clear-cache-status').textContent = `${removed} entrée(s) supprimée(s).`;
});

refreshPermissionStatus();
refreshAllowlist();
refreshRegistrarList();
