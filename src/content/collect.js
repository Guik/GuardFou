// Classic (non-module) content script — Firefox's content_scripts manifest
// key has no "type": "module" option, so this can't use ES imports. It
// scrapes raw DOM material (plus a few cheap derived fields) and hands it to
// the background script, which does the scoring, the richer identity-card
// parsing (via core/identity.js, an ES module there), and the network calls.
// The one exception is GUARDFOU_FETCH_PAGE below.
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
    // A site-relative path ("/mentions-legales.html"), resolved like a.href.
    if (/^\/[^/]/.test(value)) {
      try {
        return new URL(value, document.baseURI).href;
      } catch {
        return null;
      }
    }
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
    // exactly this pattern, invisible to a plain a[href] scan. Another
    // (chauffage-et-climatisation.fr, Magento) uses <a> tags with no href
    // and no onclick, only `data-href="/mentions-legales.html"`, opened by a
    // delegated click handler.
    const results = [];
    const candidates = document.querySelectorAll('[onclick], [role="button"], .olink, a:not([href])');
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

  // Single-page apps (Next.js, Nuxt...) often render footer links as plain
  // <span>s whose destination only lives in JavaScript: no href, no data-*
  // attribute. Their route data is usually inlined in the page, though
  // (__NEXT_DATA__, self.__next_f chunks): confirmed on lesfurets.com, whose
  // footer "Mentions légales" is a MUI <span> and whose inline scripts hold
  // "/mentions-legales". Only the page's own inline scripts are read, only
  // paths that name a legal page are kept, and each gets a text built from
  // its path so the background ranks it like a real link.
  const LEGAL_LINK_WORDING = /mentions|l[ée]gal|\bcg[uv]\b|conditions|confidentialit/i;
  const LEGAL_PATH = /(?:^|\/)(mentions[-_]?legales?|conditions[-_]generales[\w-]*|cgu|cgv|legal[-_]notice|politique[-_]de[-_]confidentialite)(?:[/.?#]|$)/i;
  const ASSET_PATH = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|woff2?|ttf|pdf)(?:[?#]|$)/i;
  const MAX_INLINE_SCRIPT_TEXT = 5_000_000;
  function getEmbeddedLegalPaths() {
    let text = '';
    for (const script of document.querySelectorAll('script:not([src])')) {
      text += ` ${script.textContent}`;
      if (text.length > MAX_INLINE_SCRIPT_TEXT) break;
    }
    const found = new Map();
    const tokens = text.replace(/\\\//g, '/').match(/https?:\/\/[^\s"'<>()\\,;{}]+|\/[\w\-./]+/g) ?? [];
    for (const token of tokens) {
      let url;
      try {
        url = new URL(token, location.href);
      } catch {
        continue;
      }
      // The path itself must name a legal page: an ad or tracking link such
      // as ".../clk/?url=https://site.fr/cgv" only has one in its query
      // string, and loading it would count as a click on the ad.
      const match = url.pathname.match(LEGAL_PATH);
      if (!match || ASSET_PATH.test(url.pathname)) continue;
      if (!/^https?:$/.test(url.protocol) || found.has(url.href)) continue;
      found.set(url.href, { text: match[1].replace(/[-_]/g, ' '), href: url.href });
      if (found.size >= 5) break;
    }
    return [...found.values()];
  }

  function getAllLinks() {
    const links = [...getRealLinks(), ...getObfuscatedLinks()];
    if (!links.some((link) => LEGAL_LINK_WORDING.test(link.text))) links.push(...getEmbeddedLegalPaths());
    return links;
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
      // <meta name="robots" content="noindex"> (or "none"), also when aimed at Google only.
      noindex: [...document.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]')]
        .some((el) => /\b(noindex|none)\b/i.test(el.getAttribute('content') || '')),
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

  // Bot protection (Cloudflare and the like) blocks the background script's
  // requests: they carry none of the site's cookies, including the one that
  // proves this browser passed the site's check. When that happens, the
  // background asks this script to read the legal page instead: from the
  // page, the request is the site's own, with its cookies, like browsing it.
  // Same origin only: never a request to another site. In Firefox,
  // content.fetch() makes the request as the page rather than the extension.
  const PAGE_FETCH_TIMEOUT_MS = 8000;
  const MAX_PAGE_HTML = 2_000_000;
  async function fetchSameOriginPage(url) {
    let target;
    try {
      target = new URL(url, location.href);
    } catch {
      return null;
    }
    if (target.origin !== location.origin) return null;
    const fetchAsPage = typeof content !== 'undefined' && typeof content?.fetch === 'function'
      ? (href) => content.fetch(href)
      : (href) => fetch(href);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PAGE_FETCH_TIMEOUT_MS));
    const res = await Promise.race([fetchAsPage(target.href), timeout]);
    if (!res.ok) return { ok: false, status: res.status, html: '' };
    const html = await Promise.race([res.text(), timeout]);
    return { ok: true, status: res.status, html: html.slice(0, MAX_PAGE_HTML) };
  }

  browser.runtime.sendMessage({ type: 'GUARDFOU_SIGNALS', payload: collectPayload() }).catch(() => {});

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'SHOW_BANNER') {
      showBanner(message.banner);
    }
    // The identity card reads the page again when it's opened rather than
    // relying on a copy kept since load — see buildIdentityCard.
    if (message?.type === 'GUARDFOU_COLLECT') {
      // sendResponse rather than a returned promise, which Chrome ignores.
      sendResponse(collectPayload());
    }
    if (message?.type === 'GUARDFOU_FETCH_PAGE') {
      fetchSameOriginPage(message.url).then(sendResponse, () => sendResponse(null));
      return true; // keeps the channel open for the async answer
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
    .bar.info { background: #5e5ce6; }
    .actions { display: flex; gap: 8px; flex-shrink: 0; }
  `;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // "!" for a warning; for information, the same mark upside down: "i".
  function createIcon(tone) {
    const info = tone === 'info';
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
    stem.setAttribute('d', info ? 'M12 11v6' : 'M12 7v6');
    stem.setAttribute('stroke', '#fff');
    stem.setAttribute('stroke-width', '2');
    stem.setAttribute('stroke-linecap', 'round');

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', '12');
    dot.setAttribute('cy', info ? '7.8' : '16.2');
    dot.setAttribute('r', '1.15');
    dot.setAttribute('fill', '#fff');

    svg.append(bg, stem, dot);
    return svg;
  }

  /**
   * @param {{ tone: 'danger'|'info', title: string, summary: string, details: string, dismiss: string }} banner
   *   already translated by the background
   */
  function showBanner(banner) {
    if (document.getElementById('guardfou-banner-host')) return;

    const host = document.createElement('div');
    host.id = 'guardfou-banner-host';
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = BANNER_STYLE;

    const bar = document.createElement('div');
    bar.className = banner.tone === 'info' ? 'bar info' : 'bar';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.appendChild(createIcon(banner.tone));

    const msg = document.createElement('div');
    msg.className = 'msg';
    const title = document.createElement('b');
    title.textContent = banner.title;
    const detail = document.createElement('span');
    detail.textContent = banner.summary;
    msg.append(title, detail);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const detailsBtn = document.createElement('button');
    detailsBtn.textContent = banner.details;
    // The same analysis as the toolbar button's.
    detailsBtn.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'GUARDFOU_OPEN_ANALYSIS' }).catch(() => {});
    });
    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = banner.dismiss;
    dismissBtn.addEventListener('click', () => host.remove());
    actions.append(detailsBtn, dismissBtn);

    bar.append(icon, msg, actions);
    shadow.append(style, bar);
    document.documentElement.appendChild(host);
  }
})();
