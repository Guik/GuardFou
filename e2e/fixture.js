// A local page that GuardFou must flag red with no network lookup at all:
// served from a raw IP (+45) over plain HTTP (+10), it claims to be
// Decathlon on a domain that isn't Decathlon's (+40). An IP address has no
// registrable domain, so the RDAP, DNSSEC and legal-page lookups are skipped.
import { createServer } from 'node:http';

const SHOP_PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Decathlon Outlet - -70% sur tout</title>
<meta property="og:site_name" content="Decathlon"><meta property="og:type" content="product"></head>
<body><h1>Decathlon Outlet</h1><p>Vélo route <s>899,00 €</s> <b>129,00 €</b></p>
<button aria-label="Ajouter au panier">Ajouter au panier</button>
<footer>© 2026 Decathlon</footer></body></html>`;

/** @returns {Promise<{ url: string, close: () => Promise<void> }>} */
export async function startShopServer() {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(SHOP_PAGE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export const REPO = new URL('..', import.meta.url).pathname;

/** Polls `check` until it returns a truthy value or `timeoutMs` elapses. */
export async function waitFor(check, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check().catch(() => null);
    if (value) return value;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
