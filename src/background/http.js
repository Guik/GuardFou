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
export function fetchWithTimeout(url, init = {}) {
  return fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
}
