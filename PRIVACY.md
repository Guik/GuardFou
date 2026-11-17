# GuardFou privacy policy

GuardFou has no server, no account, no analytics and no advertising. It never sells or shares data. Lookup results and tab verdicts stay on your device. If browser extension sync is enabled, the browser's sync service may copy your GuardFou settings to your other devices; GuardFou does not receive them.

## What GuardFou reads

On the pages you visit, GuardFou reads the address and some of the page's content: title, links, site name and structured data, prices and cart wording, and the technologies it uses. This is how it detects shops and brand impersonation. It is processed on your device and isn't sent anywhere.

## What leaves your device

To check a site, GuardFou contacts these services. Like any web request, each one also sees your IP address.

| Service | What is sent | Why |
|---|---|---|
| [rdap.org](https://rdap.org), which forwards to the registry of the domain's extension | The site's domain name | Registration date and registrar |
| [Cloudflare DNS](https://developers.cloudflare.com/1.1.1.1/privacy/public-dns-resolver/) (cloudflare-dns.com) | The site's domain name | DNSSEC status |
| [recherche-entreprises.api.gouv.fr](https://recherche-entreprises.api.gouv.fr) | The company number (SIREN/SIRET) shown on the site | French company registry lookup |
| The site itself | A normal request for its legal pages, without your cookies | Reading its legal information |
| [rdap.org](https://rdap.org), Cloudflare DNS | The site's IP address (rdap.org); the domain name (Cloudflare DNS) | Who hosts the site, shown in the identity card only |
| [HackerTarget](https://hackertarget.com/privacy/) (api.hackertarget.com) | The site's IP address, unless it belongs to a hosting platform or CDN | Other sites on the same server, shown in the identity card only |

These lookups run only:
- on pages that look like a shop or present themselves as a known brand;
- when you open a site's identity card (the hosting lookups run only then);
- on every site you visit, for the domain-age lookup only, if you turn that on in the settings.

## What is stored, and for how long

Lookup results and tab verdicts are stored locally in your browser. Settings use the browser's extension sync storage:

- **Lookup results** (domain dates and registrar, DNSSEC status, legal information found, company registry answers): 7 days, so each domain is looked up at most once a week. The settings let you clear this cache or turn it off.
- **Each tab's verdict** (score and reasons): until the tab navigates elsewhere or closes, and at most until Firefox closes.
- **Your settings** (language, watched registrars and options): until you change them or remove the extension. Chrome Sync or Firefox Sync can copy them to other devices when extension syncing is enabled. Firefox for Android does not sync extension data.

Removing GuardFou deletes its local lookup cache and tab data. Synced settings are managed by your browser's sync service.

## Contact

Questions and reports: https://github.com/Guik/GuardFou/issues
