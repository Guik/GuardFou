const BAND_LABELS = { green: 'Semble fiable', orange: 'Prudence', red: 'Risque élevé' };

async function main() {
  const hasAccess = await browser.permissions.contains({ origins: ['<all_urls>'] });
  if (!hasAccess) {
    show('activate');
    document.getElementById('activate-btn').addEventListener('click', async () => {
      const granted = await browser.permissions.request({ origins: ['<all_urls>'] });
      if (granted) window.location.reload();
    });
    return;
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    show('empty');
    return;
  }

  const verdict = await browser.runtime.sendMessage({ type: 'GET_VERDICT', tabId: tab.id });
  if (!verdict) {
    show('empty');
    return;
  }

  show('result');
  const badge = document.getElementById('band-badge');
  badge.textContent = `${BAND_LABELS[verdict.band]} — ${verdict.score}/100`;
  badge.className = `band ${verdict.band}`;
  document.getElementById('domain').textContent = verdict.domain;

  const list = document.getElementById('reasons');
  list.innerHTML = '';
  if (verdict.reasons.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Aucun signal particulier détecté.';
    list.appendChild(li);
  } else {
    for (const reason of verdict.reasons) {
      const li = document.createElement('li');
      li.textContent = reason.message;
      list.appendChild(li);
    }
  }

  document.getElementById('trust-btn').addEventListener('click', async () => {
    const { allowlist = [] } = await browser.storage.local.get('allowlist');
    if (!allowlist.includes(verdict.domain)) {
      allowlist.push(verdict.domain);
      await browser.storage.local.set({ allowlist });
    }
    window.location.reload();
  });
}

function show(sectionId) {
  for (const id of ['activate', 'result', 'empty']) {
    document.getElementById(id).hidden = id !== sectionId;
  }
}

document.getElementById('options-link').addEventListener('click', (event) => {
  event.preventDefault();
  browser.runtime.openOptionsPage();
});

main();
