# GuardFou privacy policy

GuardFou has no server, no account, no analytics and no advertising. It never sells or shares data. Everything below happens on your device, except the lookups listed under "What leaves your device".

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

These lookups run only:
- on pages that look like a shop or present themselves as a known brand;
- when you open a site's identity card;
- on every site you visit, for the domain-age lookup only, if you turn that on in the settings.

They never run for sites on your trusted list, except when you open their identity card.

## What is stored, and for how long

All of it stays in your browser:

- **Lookup results** (domain dates and registrar, DNSSEC status, legal information found, company registry answers): 7 days, so each domain is looked up at most once a week. The settings let you clear this cache or turn it off.
- **Each tab's verdict** (score and reasons): until the tab navigates elsewhere or closes, and at most until Firefox closes.
- **Your settings** (trusted sites, watched registrars, options): until you change them or remove the extension.

Removing GuardFou deletes all of it.

## Contact

Questions and reports: https://github.com/Guik/GuardFou/issues
