// Classic (non-module) content script — Firefox's content_scripts manifest
// key has no "type": "module" option, so this can't use ES imports. It does
// no network calls itself, just scrapes raw DOM material (plus a few cheap
// derived fields) and hands it to the background script, which does the
// scoring, the richer identity-card parsing (via core/identity.js, an ES
// module there), and any network calls.
(function () {
  function getMetaContent(name) {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return el?.getAttribute('content')?.trim() || null;
  }

  // Every top-level JSON-LD item on the page, with arrays and "@graph"
  // containers flattened — Yoast/WooCommerce and many Shopify themes wrap
  // everything in a single {"@graph": [...]}, which a top-level-only scan
  // misses entirely.
  function getJsonLdItems() {
    const items = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent);
        for (const item of Array.isArray(data) ? data : [data]) {
          items.push(item, ...(Array.isArray(item?.['@graph']) ? item['@graph'] : []));
        }
      } catch {
        // malformed JSON-LD on the page: ignore and keep looking
      }
    }
    return items;
  }

  function jsonLdHasType(item, ...types) {
    const type = item?.['@type'];
    return Array.isArray(type) ? type.some((t) => types.includes(t)) : types.includes(type);
  }

  function getJsonLdOrgName() {
    const org = getJsonLdItems().find((item) => jsonLdHasType(item, 'Organization', 'Store') && typeof item.name === 'string');
    return org?.name ?? null;
  }

  function getFooterCopyright() {
    const footer = document.querySelector('footer');
    const text = (footer || document.body)?.innerText || '';
    const match = text.match(/©\s*[^\n]{0,80}/) || text.match(/copyright\s*[^\n]{0,80}/i);
    return match ? match[0].slice(0, 120) : null;
  }

  // Structured product data is an unambiguous "this is a shop" on its own,
  // no visible-text heuristics needed.
  function hasProductMarkup() {
    if (getMetaContent('og:type') === 'product' || getMetaContent('product:price:amount')) return true;
    return getJsonLdItems().some((item) => jsonLdHasType(item, 'Product', 'Offer', 'AggregateOffer', 'ProductGroup'));
  }

  // Most shop headers show the cart as an icon only — the word "panier"
  // lives in an aria-label/title or the link's URL, never in innerText.
  // Confirmed on a real Shopify shop (respire.co) that the text-only check
  // missed despite prices and a cart on every page. Whole words/path
  // segments only: a plain substring "cart" would also match "carte" (a
  // restaurant menu, a map), which sits right next to prices on plenty of
  // non-shop pages.
  const CART_LABEL = /\b(panier|cart|basket)\b/i;
  const CART_PATH = /\/(cart|panier|basket|checkout)(?:[/?#.]|$)/i;
  function hasCartControl() {
    const links = document.querySelectorAll('a[href], form[action]');
    if ([...links].some((el) => CART_PATH.test(el.href || el.action || ''))) return true;
    const labelled = document.querySelectorAll('[aria-label], [title]');
    return [...labelled].some((el) => CART_LABEL.test(el.getAttribute('aria-label') || el.getAttribute('title') || ''));
  }

  function looksLikeShop() {
    if (hasProductMarkup()) return true;
    const text = (document.body?.innerText || '').toLowerCase();
    const hasEuroPrice = /\d[\d\s]*[.,]?\d{0,2}\s*(€|eur\b)|€\s*\d/.test(text);
    const hasCartWording = /panier|add to cart|add to bag|commander|passer commande/.test(text);
    return hasEuroPrice && (hasCartWording || hasCartControl());
  }

  function getRealLinks() {
    // `a.href` (the DOM property, not getAttribute) resolves relative URLs
    // against the page's base URI, so these are always absolute. The actual
    // tech/social/legal-link detection logic lives in core/identity.js and
    // runs in the background script, which can use ES modules.
    return [...document.querySelectorAll('a[href]')].map((a) => ({ text: a.textContent.trim(), href: a.href }));
  }

  function decodeUrlCandidate(value) {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    try {
      const decoded = atob(value);
      return /^https?:\/\//i.test(decoded) ? decoded : null;
    } catch {
      return null; // not valid base64: not a URL candidate
    }
  }

  function getObfuscatedLinks() {
    // Some sites use a clickable element (not a real <a href>) whose
    // destination is tucked into a data-* attribute, plain or base64-
    // encoded, and dispatched via JS on click — e.g.
    // `<span class="olink" data-olink="aHR0cHM6Ly8..." onclick="goLink(...)">`.
    // Confirmed on a real site whose own mentions-légales/CGV links use
    // exactly this pattern, invisible to a plain a[href] scan.
    const results = [];
    const candidates = document.querySelectorAll('[onclick], [role="button"], .olink');
    for (const el of candidates) {
      for (const attr of el.attributes) {
        if (!attr.name.startsWith('data-')) continue;
        const decoded = decodeUrlCandidate(attr.value);
        if (decoded) {
          results.push({ text: el.textContent.trim(), href: decoded });
          break;
        }
      }
    }
    return results;
  }

  function getAllLinks() {
    return [...getRealLinks(), ...getObfuscatedLinks()];
  }

  function getTechHints() {
    // A compact substitute for shipping the whole page HTML to the
    // background: enough surface (script/stylesheet URLs, body classes) for
    // CMS/platform fingerprinting without the cost of a multi-MB payload.
    const scriptSrcs = [...document.querySelectorAll('script[src]')].map((s) => s.src);
    const linkHrefs = [...document.querySelectorAll('link[href]')].map((l) => l.href);
    return [...scriptSrcs, ...linkHrefs, document.body?.className || ''].join(' ');
  }

  function getSeoMeta() {
    const images = document.querySelectorAll('img');
    return {
      hasMetaDescription: Boolean(getMetaContent('description')),
      hasCanonical: Boolean(document.querySelector('link[rel="canonical"]')),
      hasOgTitle: Boolean(getMetaContent('og:title')),
      titleLength: (document.title || '').trim().length,
      h1Count: document.querySelectorAll('h1').length,
      imageCount: images.length,
      imagesMissingAlt: [...images].filter((img) => !img.hasAttribute('alt')).length,
    };
  }

  function collectPayload() {
    return {
      title: document.title || null,
      ogSiteName: getMetaContent('og:site_name'),
      jsonLdOrgName: getJsonLdOrgName(),
      footerCopyright: getFooterCopyright(),
      isLikelyShop: looksLikeShop(),
      htmlLang: document.documentElement.getAttribute('lang'),
      generatorMeta: getMetaContent('generator'),
      techHints: getTechHints(),
      allLinks: getAllLinks(),
      seoMeta: getSeoMeta(),
    };
  }

  browser.runtime.sendMessage({ type: 'GUARDFOU_SIGNALS', payload: collectPayload() }).catch(() => {});

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'SHOW_BANNER') {
      showBanner(message.verdict);
    }
    // The identity card reads the page again when it's opened rather than
    // relying on a copy kept since load — see buildIdentityCard.
    if (message?.type === 'GUARDFOU_COLLECT') {
      return Promise.resolve(collectPayload());
    }
    return undefined;
  });

  // Static markup only (no interpolation); all dynamic text below is set via
  // textContent, never innerHTML, so page-controlled strings (brand names,
  // reasons) can never be interpreted as HTML.
  const BANNER_STYLE = `
    :host {
      all: initial;
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      display: block;
      animation: guardfou-drop 0.45s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes guardfou-drop {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .bar {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      background: #d70015; color: #fff; padding: 12px 18px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: 0 2px 12px rgba(0,0,0,.25);
    }
    .icon { flex-shrink: 0; width: 22px; height: 22px; }
    .msg { flex: 1; min-width: 0; font-size: 13px; line-height: 1.4; }
    .msg b { font-size: 14px; font-weight: 600; display: block; margin-bottom: 1px; letter-spacing: -0.01em; }
    .msg span { opacity: 0.92; }
    button {
      font-family: inherit; background: rgba(255,255,255,.16); color: #fff; border: none;
      border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background-color 0.15s ease;
    }
    button:hover { background: rgba(255,255,255,.3); }
    .actions { display: flex; gap: 8px; flex-shrink: 0; }
  `;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function createWarningIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');

    const bg = document.createElementNS(SVG_NS, 'circle');
    bg.setAttribute('cx', '12');
    bg.setAttribute('cy', '12');
    bg.setAttribute('r', '10');
    bg.setAttribute('fill', '#fff');
    bg.setAttribute('fill-opacity', '0.18');

    const stem = document.createElementNS(SVG_NS, 'path');
    stem.setAttribute('d', 'M12 7v6');
    stem.setAttribute('stroke', '#fff');
    stem.setAttribute('stroke-width', '2');
    stem.setAttribute('stroke-linecap', 'round');

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', '12');
    dot.setAttribute('cy', '16.2');
    dot.setAttribute('r', '1.15');
    dot.setAttribute('fill', '#fff');

    svg.append(bg, stem, dot);
    return svg;
  }

  function showBanner(verdict) {
    if (document.getElementById('guardfou-banner-host')) return;

    const host = document.createElement('div');
    host.id = 'guardfou-banner-host';
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = BANNER_STYLE;

    const bar = document.createElement('div');
    bar.className = 'bar';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.appendChild(createWarningIcon());

    const msg = document.createElement('div');
    msg.className = 'msg';
    const title = document.createElement('b');
    title.textContent = `GuardFou : ce site est suspect (score ${verdict.score}/100)`;
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

    bar.append(icon, msg, actions);
    shadow.append(style, bar);
    document.documentElement.appendChild(host);
  }
})();
