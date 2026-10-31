// Classic (non-module) content script: runs in every page, does no network
// calls itself, just scrapes cheap DOM signals and hands them to the
// background script, which does the scoring and any network lookups.
(function () {
  function getMetaContent(name) {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return el?.getAttribute('content')?.trim() || null;
  }

  function getJsonLdOrgName() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const type = item?.['@type'];
          if (type === 'Organization' || type === 'Store' || (Array.isArray(type) && type.includes('Organization'))) {
            if (typeof item.name === 'string') return item.name;
          }
        }
      } catch {
        // malformed JSON-LD on the page: ignore and keep looking
      }
    }
    return null;
  }

  function getFooterCopyright() {
    const footer = document.querySelector('footer');
    const text = (footer || document.body).innerText || '';
    const match = text.match(/©\s*[^\n]{0,80}/) || text.match(/copyright\s*[^\n]{0,80}/i);
    return match ? match[0].slice(0, 120) : null;
  }

  function looksLikeShop() {
    const text = (document.body.innerText || '').toLowerCase();
    const hasEuroPrice = /\d[\d\s]*[.,]?\d{0,2}\s*(€|eur\b)/.test(text);
    const hasCartWording = /panier|ajouter au panier|add to cart|commander|passer commande/.test(text);
    return hasEuroPrice && hasCartWording;
  }

  const payload = {
    title: document.title || null,
    ogSiteName: getMetaContent('og:site_name'),
    jsonLdOrgName: getJsonLdOrgName(),
    footerCopyright: getFooterCopyright(),
    isLikelyShop: looksLikeShop(),
  };

  browser.runtime.sendMessage({ type: 'FAKESHIELD_SIGNALS', payload }).catch(() => {});

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'SHOW_BANNER') {
      showBanner(message.verdict);
    }
  });

  // Static markup only (no interpolation); all dynamic text below is set
  // via textContent, never innerHTML, so page-controlled strings (brand
  // names, reasons) can never be interpreted as HTML.
  const BANNER_STYLE = `
    :host {
      all: initial;
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      display: block;
    }
    .bar { font-family: system-ui, sans-serif; background: #c62828; color: #fff; padding: 10px 16px;
           display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
    .msg { font-size: 14px; line-height: 1.4; }
    .msg b { font-size: 15px; display: block; margin-bottom: 2px; }
    button { background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.4);
             border-radius: 4px; padding: 6px 10px; font-size: 13px; cursor: pointer; }
    button:hover { background: rgba(255,255,255,.3); }
    .actions { display: flex; gap: 8px; flex-shrink: 0; }
  `;

  function showBanner(verdict) {
    if (document.getElementById('fakeshield-banner-host')) return;

    const host = document.createElement('div');
    host.id = 'fakeshield-banner-host';
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = BANNER_STYLE;

    const bar = document.createElement('div');
    bar.className = 'bar';

    const msg = document.createElement('div');
    msg.className = 'msg';
    const title = document.createElement('b');
    title.textContent = `⚠️ FakeShield : ce site est suspect (score ${verdict.score}/100)`;
    const detail = document.createElement('span');
    detail.textContent = verdict.reasons[0]?.message || '';
    msg.append(title, detail);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const detailsBtn = document.createElement('button');
    detailsBtn.textContent = 'Détails';
    detailsBtn.addEventListener('click', () => {
      // eslint-disable-next-line no-alert
      alert(verdict.reasons.map((r) => `• ${r.message}`).join('\n'));
    });
    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = 'Ignorer';
    dismissBtn.addEventListener('click', () => host.remove());
    actions.append(detailsBtn, dismissBtn);

    bar.append(msg, actions);
    shadow.append(style, bar);
    document.documentElement.appendChild(host);
  }
})();
