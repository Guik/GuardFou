/**
 * Interpret a DNS-over-HTTPS JSON response (Cloudflare/Google format) for a
 * DNSKEY query made with `do=true` (DNSSEC OK) and checking left enabled, so
 * the resolver's own validation is meaningful.
 *
 * - `signed`: the zone publishes DNSKEY records at all.
 * - `validated`: the resolver's chain-of-trust validation succeeded (AD flag).
 * - `bogus`: the resolver rejected an invalid signature (SERVFAIL, RCODE 2) —
 *   this is the actually alarming case: a signed zone whose signature does
 *   not check out, which can indicate a hijacked or spoofed DNS answer.
 *
 * Most legitimate sites simply don't sign their zone at all, so `signed:
 * false` on its own is not a useful fraud signal and the scoring should
 * treat it as neutral.
 *
 * @param {{Status?: number, AD?: boolean, Answer?: Array<unknown>}} dohResponse
 */
export function interpretDnssecResponse(dohResponse) {
  const hasDnskey = Array.isArray(dohResponse?.Answer) && dohResponse.Answer.length > 0;
  return {
    signed: hasDnskey,
    validated: hasDnskey && dohResponse?.AD === true,
    bogus: dohResponse?.Status === 2,
  };
}
