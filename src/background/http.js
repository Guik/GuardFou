const TIMEOUT_MS = 8000;

/**
 * fetch() with a timeout and without the user's cookies, for every lookup
 * the analysis makes. Without a timeout, one unresponsive server (a hanging
 * legal page, a slow RDAP registry) stalls the whole Promise.all and no
 * verdict is ever published for the tab. A timeout rejects like any other
 * network error, so callers treat it as a failed lookup — not cached,
 * retried next time. Cookies are never needed here, and sending them would
 * fetch the site's pages as the logged-in user.
 * @param {string} url
 * @param {RequestInit} [init]
 */
export async function fetchWithTimeout(url, init = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
    logIfSlow(url, started, `HTTP ${res.status}`);
    return res;
  } catch (error) {
    logIfSlow(url, started, error?.name === 'TimeoutError' ? 'timed out' : 'failed', true);
    throw error;
  }
}

// Requests slower than this are logged to the extension's own console
// (about:debugging / chrome://extensions), to find what makes an analysis
// slow on a given site. Nothing leaves the browser.
const SLOW_REQUEST_MS = 2000;

/**
 * @param {string} url
 * @param {number} started Date.now() when the request began
 * @param {string} outcome
 * @param {boolean} [always] log even when fast (failures)
 */
export function logIfSlow(url, started, outcome, always = false) {
  const elapsed = Date.now() - started;
  if (!always && elapsed < SLOW_REQUEST_MS) return;
  let shown = url;
  try {
    const { host, pathname } = new URL(url);
    shown = host + pathname;
  } catch {
    // keep the raw string
  }
  console.info(`GuardFou: ${shown} — ${outcome} after ${(elapsed / 1000).toFixed(1)} s`);
}
