/**
 * Interpret a DNS-over-HTTPS JSON response (Cloudflare/Google format) for a
 * DNSKEY query made with `do=true` (DNSSEC OK) and checking left enabled, so
 * the resolver's own validation is meaningful.
 *
 * - `signed`: the zone publishes DNSKEY records at all.
 * - `validated`: the resolver's chain-of-trust validation succeeded (AD flag).
 * - `bogus`: the zone is signed but its signatures don't check out, which can
 *   indicate a hijacked or spoofed DNS answer — the actually alarming case.
 *   The resolver reports that as SERVFAIL (RCODE 2), but so does a broken
 *   or unreachable nameserver, so it only counts as bogus when the same
 *   query with checking disabled (`cd=true`) then succeeds.
 *
 * Most legitimate sites simply don't sign their zone at all, so `signed:
 * false` on its own is not a useful fraud signal and the scoring should
 * treat it as neutral.
 *
 * @param {{Status?: number, AD?: boolean, Answer?: Array<unknown>}} dohResponse
 * @param {{Status?: number, Answer?: Array<unknown>}|null} [uncheckedResponse]
 *   the same query with `cd=true`, only needed when dohResponse is a SERVFAIL
 */
export function interpretDnssecResponse(dohResponse, uncheckedResponse = null) {
  const hasDnskey = (response) => Array.isArray(response?.Answer) && response.Answer.length > 0;
  const bogus = dohResponse?.Status === 2 && uncheckedResponse?.Status === 0 && hasDnskey(uncheckedResponse);
  return {
    signed: hasDnskey(dohResponse) || bogus,
    validated: hasDnskey(dohResponse) && dohResponse?.AD === true,
    bogus,
  };
}
