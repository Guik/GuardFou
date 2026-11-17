// Requests every official domain of every brand in src/data/brands-fr.js and
// reports where it leads. A report, not a check: run it by hand with
// `npm run check:brands`. It is not run in CI, and it always exits 0.
import { BRANDS_FR } from '../src/data/brands-fr.js';
import { getRegistrableDomain } from '../src/core/domain.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 4;
const STALE_AFTER_DAYS = 180;

/** One GET per domain, never retried. Network errors and timeouts are returned, not thrown. */
async function probe(domain) {
  try {
    const response = await fetch(`https://${domain}/`, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await response.body?.cancel();
    return { ok: true, status: response.status, finalUrl: response.url };
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return { ok: false, error: timedOut ? 'timeout' : (error.cause?.code ?? error.message) };
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const jobs = BRANDS_FR.flatMap((brand) => brand.officialDomains.map((domain) => ({ brand, domain })));
console.log(`Checking ${jobs.length} official domains of ${BRANDS_FR.length} brands (${CONCURRENCY} at a time, ${TIMEOUT_MS / 1000} s timeout)...\n`);

const results = await mapWithConcurrency(jobs, CONCURRENCY, async ({ brand, domain }) => {
  const result = await probe(domain);
  if (!result.ok) return { brand, domain, result, failed: true };
  const finalHost = new URL(result.finalUrl).hostname;
  const finalRegistrable = getRegistrableDomain(finalHost);
  const listed = brand.officialDomains.includes(finalRegistrable);
  return { brand, domain, result, finalHost, finalRegistrable, listed };
});

for (const entry of results) {
  const { brand, domain, result } = entry;
  if (entry.failed) {
    console.log(`FAILED   ${brand.name}: ${domain} (${result.error})`);
  } else {
    const flag = entry.listed ? 'listed ' : 'NOT LISTED';
    console.log(`${result.status}  ${flag} ${brand.name}: ${domain} -> ${result.finalUrl}`);
  }
}

const failed = results.filter((entry) => entry.failed);
const candidates = results.filter((entry) => !entry.failed && !entry.listed);
const now = Date.now();
const stale = BRANDS_FR.filter((brand) => (now - Date.parse(`${brand.verified}T00:00:00Z`)) / 86_400_000 > STALE_AFTER_DAYS);

console.log('\n=== Summary ===');
console.log(`\n(1) Failed (network error or timeout): ${failed.length}`);
for (const { brand, domain, result } of failed) console.log(`  - ${brand.name}: ${domain} (${result.error})`);

console.log(`\n(2) Redirects to a domain not in the brand's list (candidates to add): ${candidates.length}`);
for (const { brand, domain, result, finalRegistrable } of candidates) {
  console.log(`  - ${brand.name}: ${domain} -> ${result.finalUrl} (registrable: ${finalRegistrable ?? 'none'})`);
}

console.log(`\n(3) Brands verified more than ${STALE_AFTER_DAYS} days ago: ${stale.length}`);
for (const brand of stale) console.log(`  - ${brand.name}: verified ${brand.verified}`);
