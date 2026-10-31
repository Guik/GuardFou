async function refreshPermissionStatus() {
  const hasAccess = await browser.permissions.contains({ origins: ['<all_urls>'] });
  document.getElementById('permission-status').textContent = hasAccess
    ? '✅ Accès accordé.'
    : '❌ Accès non accordé : FakeShield ne peut analyser aucune page.';
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

refreshPermissionStatus();
refreshAllowlist();
