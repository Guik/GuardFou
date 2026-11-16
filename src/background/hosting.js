import { fetchWithTimeout } from './http.js';
import { getCached, setCached, CACHE_TTL_MS } from './cache.js';
import { getRegistrableDomain } from '../core/domain.js';
import { isCloudflareIp, interpretIpRdap, platformFromOwner, parseReverseIpResponse, neighborDomains } from '../core/hosting.js';

/**
 * Where a site is hosted, for the identity card only: its IPv4 address
 * (Cloudflare DNS-over-HTTPS), who owns that address (RDAP, via rdap.org)
 * and, unless it's a known platform or CDN, the other sites on it
 * (HackerTarget's free reverse IP lookup, quota-limited). Cached a week per
 * domain, only when every lookup it needed answered.
 * @param {string} domain registrable domain
 * @returns {Promise<{ ip: string, owner: string|null, country: string|null, platform: string|null, neighbors: string[]|null } | null>}
 */
export async function getHostingInfo(domain) {
  const cacheKey = `hosting:${domain}`;
  const cached = await getCached(cacheKey, CACHE_TTL_MS);
  if (cached !== undefined) return cached;

  const result = await fetchHostingInfo(domain);
  if (result.ok) await setCached(cacheKey, result.info);
  return result.info;
}

async function fetchHostingInfo(domain) {
  try {
    // The site usually answers on www. too; the bare domain is what was registered.
    const ip = (await resolveIpv4(domain)) ?? (await resolveIpv4(`www.${domain}`));
    if (!ip) return { ok: true, info: null };

    const rdap = await fetchWithTimeout(`https://rdap.org/ip/${ip}`, { headers: { Accept: 'application/rdap+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    const { owner, country } = interpretIpRdap(rdap);
    const platform = isCloudflareIp(ip) ? 'Cloudflare' : platformFromOwner(owner);

    // On a platform or CDN, the address is shared by countless sites:
    // listing them is noise, and it would spend the lookup quota.
    let neighbors = null;
    if (!platform) {
      const text = await fetchWithTimeout(`https://api.hackertarget.com/reverseiplookup/?q=${ip}`)
        .then((res) => (res.ok ? res.text() : ''))
        .catch(() => '');
      const hostnames = parseReverseIpResponse(text);
      neighbors = hostnames ? neighborDomains(hostnames, domain, getRegistrableDomain) : null;
    }
    return { ok: rdap !== null && (platform !== null || neighbors !== null), info: { ip, owner, country, platform, neighbors } };
  } catch {
    return { ok: false, info: null };
  }
}

async function resolveIpv4(name) {
  const res = await fetchWithTimeout(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=A`, {
    headers: { Accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  const data = await res.json();
  // type 1 = A; CNAME records (type 5) come first when there's a chain.
  return data.Answer?.find((a) => a.type === 1)?.data ?? null;
}
