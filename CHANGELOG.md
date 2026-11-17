# Changelog

Each version has an English and a French section. When a version is tagged,
the release workflow sends them to addons.mozilla.org as that version's
release notes (English as en-US, French as fr) and puts both in the GitHub
Release. A tag whose version has no section here, or no English section,
isn't released.

## 0.1.5

### English

- The trusted-sites list is back in the settings, and now syncs with your other settings. If you had one before 0.1.4, please add your sites again.
- The watched-registrars setting has been removed; GuardFou keeps using its built-in list.
- The legal-notice line in the popup is shorter and fits on one line.
- The popup shows that the page is being analyzed instead of staying blank, and waits for the result when the analysis is still running.
- When a site's bot protection (such as Cloudflare) blocks the legal-page check, the page you're on now reads them from its own site instead. If that fails too, they are reported as unreadable, without raising the score, instead of as missing, and the site is not asked again for a day.
- Legal links that are not real links (plain text opened by JavaScript, as on many Next.js sites) are now found through the addresses the page itself embeds.
- The company behind a site is recognised in more legal-notice wordings ("propriété de", "publié par", the name written before the SIRET or RCS), so a site run by a company with another name, such as LesFurets by La Centrale de Financement, is no longer suspected of reusing a SIRET.
- When a legal notice gives the hosting provider's SIRET before the publisher's, the publisher's is now checked: the host's no longer triggers a false "reused SIRET" warning.
- A page that declares its own site name is no longer taken for a brand mentioned in its title: a comparison site's guide about EDF is no longer flagged as impersonating EDF.
- In the identity card, the other sites on the same server are now links.
- The identity card recognises more technologies: site builders, including AI ones (Lovable, Framer, Webflow, Hostinger, GoDaddy, Jimdo, Duda, Square Online), Odoo, and the Next.js, Nuxt and Vite frameworks.
- A new domain whose pages ask search engines not to list them now adds to the score.
- Brand impersonation now covers windshield repair (Carglass, France Pare-Brise, Mondial Pare-Brise), energy (EDF, Engie, TotalEnergies) and insurance (AXA, Allianz, Groupama, MAIF, Macif, MAAF, Matmut, GMF).
- Look-alike domain checks no longer apply to Boulanger's name, which is also a common French word: a site such as boulanger-direct.fr is no longer flagged. A page that names itself Boulanger is still checked.

### Français

- La liste des sites de confiance est de retour dans les paramètres, et se synchronise désormais avec vos autres réglages. Si vous en aviez une avant la 0.1.4, ajoutez de nouveau vos sites.
- Le réglage des bureaux d'enregistrement surveillés a été supprimé ; GuardFou continue d'utiliser sa liste intégrée.
- La ligne des mentions légales du popup est plus courte et tient sur une seule ligne.
- Le popup indique que la page est en cours d'analyse au lieu de rester vide, et attend le résultat si l'analyse n'est pas terminée.
- Quand la protection anti-robots d'un site (comme Cloudflare) bloque la vérification des pages légales, c'est désormais la page ouverte qui les lit depuis son propre site. Si cela échoue aussi, elles sont signalées comme illisibles, sans augmenter le score, au lieu d'être déclarées absentes, et le site n'est pas sollicité de nouveau avant le lendemain.
- Les liens légaux qui ne sont pas de vrais liens (du texte ouvert par JavaScript, comme sur de nombreux sites Next.js) sont désormais retrouvés grâce aux adresses que la page contient elle-même.
- La société derrière un site est reconnue dans plus de formulations des mentions légales (« propriété de », « publié par », le nom écrit avant le SIRET ou le RCS) : un site exploité par une société d'un autre nom, comme LesFurets par La Centrale de Financement, n'est plus soupçonné de réutiliser un SIRET.
- Quand des mentions légales donnent le SIRET de l'hébergeur avant celui de l'éditeur, c'est désormais celui de l'éditeur qui est vérifié : celui de l'hébergeur ne déclenche plus une fausse alerte de « SIRET réutilisé ».
- Une page qui déclare son propre nom de site n'est plus prise pour une marque citée dans son titre : le guide d'un comparateur sur EDF n'est plus signalé comme usurpant EDF.
- Dans la fiche d'identité, les autres sites du même serveur sont désormais des liens.
- La fiche d'identité reconnaît plus de technologies : les créateurs de sites, y compris par IA (Lovable, Framer, Webflow, Hostinger, GoDaddy, Jimdo, Duda, Square Online), Odoo, et les frameworks Next.js, Nuxt et Vite.
- Un domaine récent dont les pages demandent à ne pas être référencées par les moteurs de recherche augmente désormais le score.
- La détection d'usurpation de marque couvre désormais le remplacement de pare-brise (Carglass, France Pare-Brise, Mondial Pare-Brise), l'énergie (EDF, Engie, TotalEnergies) et l'assurance (AXA, Allianz, Groupama, MAIF, Macif, MAAF, Matmut, GMF).
- La détection des domaines qui imitent Boulanger ne vise plus les variantes proches du nom, car « boulanger » est aussi un mot courant : un site comme boulanger-direct.fr n'est plus signalé. Une page qui se présente comme Boulanger reste contrôlée.

## 0.1.4

### English

- Settings now sync across your devices through Chrome Sync or Firefox Sync when extension syncing is enabled. Existing settings are carried over; lookup results stay on each device.
- New option to ignore the raw-IP and unencrypted-HTTP warnings on private IP addresses (local services, development servers).
- The trusted-sites list has been removed: every site is now checked.
- The settings page no longer shows internal names in place of a missing translation.

### Français

- Les paramètres se synchronisent désormais entre vos appareils via Chrome Sync ou Firefox Sync lorsque la synchronisation des extensions est activée. Les réglages existants sont conservés ; les résultats des recherches restent sur chaque appareil.
- Nouvelle option pour ignorer les alertes d'adresse IP brute et de connexion HTTP non chiffrée sur les adresses IP privées (services locaux, serveurs de développement).
- La liste des sites de confiance a été supprimée : tous les sites sont désormais vérifiés.
- La page des paramètres n'affiche plus d'identifiants techniques à la place d'une traduction manquante.

## 0.1.3

### English

- The popup now summarizes domain dates, company details and legal-notice checks. The identity card adds a timeline comparing the company's creation date with the domain's registration date.
- The identity card now shows the site's hosting provider and IP address, and lists other sites found on the same server.
- Hosting lookups now use the hostname you visited, so `www` and the bare domain can show different providers correctly.
- Long details now wrap within the popup, and the compact domain summary no longer includes the registrar name.

### Français

- Le popup résume désormais les dates du domaine, les informations sur l'entreprise et les vérifications des mentions légales. La fiche d'identité ajoute une chronologie qui compare la création de l'entreprise à l'enregistrement du domaine.
- La fiche d'identité indique désormais le fournisseur d'hébergement et l'adresse IP du site, et liste les autres sites détectés sur le même serveur.
- La recherche d'hébergement utilise maintenant le nom d'hôte consulté : `www` et le domaine nu peuvent ainsi afficher des fournisseurs différents.
- Les informations longues tiennent désormais dans le popup, et le nom du registrar a été retiré du résumé compact du domaine.

## 0.1.2

### English

- The interface is available in English and French. It follows Firefox's language, and the settings let you pick one.
- Legal notice pages linked through a script instead of a regular link are now found, so these sites no longer get a false "no legal notice" warning.
- A company number belonging to the company that the legal notice names as publisher (a site trading under another brand) is no longer reported as someone else's number.
- New icon.

### Français

- L'interface est disponible en anglais et en français. Elle suit la langue de Firefox, et les réglages permettent d'en choisir une.
- Les pages de mentions légales ouvertes par un script plutôt que par un lien classique sont désormais trouvées : ces sites n'ont plus de fausse alerte « aucune mention légale ».
- Un numéro d'entreprise appartenant à la société que les mentions légales désignent comme éditeur (un site exploité sous une autre enseigne) n'est plus signalé comme le numéro d'une autre entreprise.
- Nouvelle icône.

## 0.1.0

### English

- First release.

### Français

- Première version.
